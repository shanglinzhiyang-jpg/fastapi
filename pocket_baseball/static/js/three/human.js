/* 熱闘！ポケットベースボール — 実写寄りの選手モデル
 * tools/human/build_player.py で MakeHuman (CC0) の人体から作ったメッシュ (static/models/player.*) を読み込み、
 * 選手ごとに骨格・顔の差分 (モーフ)・ユニフォームのテクスチャを組み立てる。
 * 形は全選手で共有し、骨とマテリアルだけを選手ごとに持つ。
 * createPlayer() は model.js (簡易モデル) と同じ形の戻り値を返すので、どちらでも描画側は同じに扱える。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const A = PB.Anim;
  const H = { ready: false, loading: null };
  const D2R = Math.PI / 180;

  let asset = null;

  /* ---------- 読み込み ---------- */
  H.load = function (base) {
    if (H.loading) return H.loading;
    base = base || "models/";
    H.loading = Promise.all([fetch(base + "player.json").then((r) => r.json()), fetch(base + "player.bin").then((r) => r.arrayBuffer())])
      .then(([json, bin]) => {
        asset = { json, geos: {}, bones: json.bones, extra: json.extra };
        for (const m of json.meshes) asset.geos[m.name] = buildGeometry(m, bin);
        const tl = new T.TextureLoader();
        const load = (f) =>
          new Promise((res) => {
            tl.load(base + f, (t) => {
              t.colorSpace = T.SRGBColorSpace;
              t.anisotropy = 4;
              res(t);
            }, undefined, () => res(null));
          });
        return Promise.all(json.skins.map(load).concat([load(json.eye)])).then((texs) => {
          asset.skins = texs.slice(0, json.skins.length);
          asset.eye = texs[texs.length - 1];
          prepRig();
          prepScale();
          H.ready = true;
          return H;
        });
      })
      .catch((e) => {
        console.warn("選手モデルを読み込めませんでした", e);
        H.failed = true;
        return null;
      });
    return H.loading;
  };

  function buildGeometry(m, bin) {
    const g = new T.BufferGeometry();
    const n = m.count;
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(bin, m.position, n * 3), 3));
    g.setAttribute("normal", new T.BufferAttribute(new Int16Array(bin, m.normal, n * 3), 3, true));
    if (m.uv != null) g.setAttribute("uv", new T.BufferAttribute(new Float32Array(bin, m.uv, n * 2), 2));
    if (m.color != null) g.setAttribute("color", new T.BufferAttribute(new Uint8Array(bin, m.color, n * 3), 3, true));
    // 肌の薄さ (耳・指が逆光で透ける量)
    if (m.thick != null) g.setAttribute("thick", new T.BufferAttribute(new Uint8Array(bin, m.thick, n), 1, true));
    g.setAttribute("skinIndex", new T.BufferAttribute(new Uint8Array(bin, m.skinIndex, n * 4), 4));
    g.setAttribute("skinWeight", new T.BufferAttribute(new Uint8Array(bin, m.skinWeight, n * 4), 4, true));
    g.setIndex(new T.BufferAttribute(m.index32 ? new Uint32Array(bin, m.index, m.indexCount) : new Uint16Array(bin, m.index, m.indexCount), 1));
    if (m.morphs && m.morphs.length) {
      g.morphTargetsRelative = true;
      g.morphAttributes.position = m.morphs.map((mm) => {
        const q = new Int16Array(bin, mm.offset, n * 3);
        const f = new Float32Array(n * 3);
        const s = m.morphScale / 32767;
        for (let i = 0; i < f.length; i++) f[i] = q[i] * s;
        const a = new T.BufferAttribute(f, 3);
        a.name = mm.name;
        return a;
      });
      g.userData.morphNames = m.morphs.map((mm) => mm.name);
    }
    g.computeBoundingSphere();
    g.boundingSphere.radius = 2.5;
    return g;
  }

  /* ---------- リグの準備 (休止姿勢の向き・曲がる軸) ---------- */
  const RIG = {};
  function prepRig() {
    const B = {};
    asset.bones.forEach((b) => (B[b.name] = new T.Vector3().fromArray(b.pos)));
    RIG.B = B;
    const n = (v) => v.clone().normalize();
    const Z = new T.Vector3(0, 0, 1);
    for (const s of ["l", "r"]) {
      const ru = n(B["lowerarm_" + s].clone().sub(B["upperarm_" + s]));
      const rf = n(B["hand_" + s].clone().sub(B["lowerarm_" + s]));
      const au = n(ru.clone().cross(Z));
      const af = n(au.clone().sub(rf.clone().multiplyScalar(au.dot(rf))));
      RIG["arm_" + s] = { ru, rf, au, af, L1: B["lowerarm_" + s].distanceTo(B["upperarm_" + s]), L2: B["hand_" + s].distanceTo(B["lowerarm_" + s]) };
      const rt = n(B["calf_" + s].clone().sub(B["thigh_" + s]));
      const rc = n(B["foot_" + s].clone().sub(B["calf_" + s]));
      const at = n(rt.clone().cross(new T.Vector3(0, 0, -1)));
      const ac = n(at.clone().sub(rc.clone().multiplyScalar(at.dot(rc))));
      RIG["leg_" + s] = { ru: rt, rf: rc, au: at, af: ac, L1: B["calf_" + s].distanceTo(B["thigh_" + s]), L2: B["foot_" + s].distanceTo(B["calf_" + s]) };
      // 手: 休止姿勢の手 → 「指が下・手のひらが体の内側・親指が前」の標準の手へ
      const fd = n(B["middle_01_" + s].clone().sub(B["hand_" + s]));
      const palm = new T.Vector3().fromArray(asset.extra["palm_" + s]);
      const m1 = frame(fd, palm);
      const m2 = frame(new T.Vector3(0, -1, 0), new T.Vector3(s === "l" ? -1 : 1, 0, 0));
      const R = new T.Matrix4().multiplyMatrices(m2, m1.clone().transpose());
      RIG["hand_" + s] = new T.Quaternion().setFromRotationMatrix(R);
      // 指の曲がる軸
      RIG["fingers_" + s] = {};
      for (const f of ["index", "middle", "ring", "pinky", "thumb"]) {
        const axes = [];
        for (let k = 1; k <= 3; k++) {
          const a = B[f + "_0" + k + "_" + s];
          const b = k < 3 ? B[f + "_0" + (k + 1) + "_" + s] : null;
          const dir = b ? n(b.clone().sub(a)) : axes.length ? axes[axes.length - 1].dir : fd;
          axes.push({ dir, axis: n(dir.clone().cross(palm)) });
        }
        RIG["fingers_" + s][f] = axes;
      }
    }
  }
  // 2 本のベクトル (主軸 a, 副軸 b) から正規直交基底の行列を作る
  function frame(a, b) {
    const x = a.clone().normalize();
    const y = b.clone().sub(x.clone().multiplyScalar(b.dot(x))).normalize();
    const z = x.clone().cross(y);
    return new T.Matrix4().makeBasis(x, y, z);
  }

  /* ---------- 画像の読み込み (胸マーク・帽子マーク・ワッペン) ---------- */
  const IMG = {};
  H.image = function (url) {
    if (!url) return null;
    if (!IMG[url]) {
      const e = { img: new Image(), ok: false, p: null };
      e.p = new Promise((res) => {
        e.img.onload = () => {
          e.ok = true;
          res(e);
        };
        e.img.onerror = () => res(e);
      });
      e.img.src = url;
      IMG[url] = e;
    }
    return IMG[url];
  };
  // ユニフォームの文字に使うフォント (Google Fonts)。読めない環境では 3 秒で待つのをやめ、代替フォントで描く
  const FONTS = ["Graduate", "Ultra", "Yellowtail", "Archivo Black", "Lobster", "Oleo Script"];
  const FONT_WEIGHT = { "Oleo Script": 700 };
  let fontsP = null;
  H.fontsReady = function () {
    if (fontsP) return fontsP;
    const loads = document.fonts && document.fonts.load ? FONTS.map((f) => document.fonts.load((FONT_WEIGHT[f] || 400) + " 40px '" + f + "'").catch(() => null)) : [];
    fontsP = Promise.race([Promise.all(loads), new Promise((res) => setTimeout(res, 3000))]).then(() => null);
    return fontsP;
  };
  // 球団のユニフォームに使う画像とフォントを先に読み込む
  H.preloadTeam = function (team) {
    const def = (PB.D.teamDef && PB.D.teamDef(team.id)) || team;
    const urls = [];
    for (const side of ["home", "away"]) {
      const u = def[side] || {};
      for (const k of ["word", "sleevePatch", "sleeveWord"]) if (u[k]) urls.push(u[k]);
      if (u.cap && u.cap.mark) urls.push(u.cap.mark);
      if (u.helmet && u.helmet.mark) urls.push(u.helmet.mark);
    }
    if (def.capStyle && def.capStyle.mark) urls.push(def.capStyle.mark);
    if (def.helmet && def.helmet.mark) urls.push(def.helmet.mark);
    return Promise.all(urls.map((u) => H.image(u).p).concat([H.fontsReady()]));
  };

  /* ---------- ユニフォーム (npb.js の定義から描く) ---------- */
  // home/away の項目に球団共通の値 (under/socks/belt/capStyle/helmet) を合わせる。side.cap / side.helmet で片側だけ帽子を変えられる (阪神のビジター)
  function uniformOf(team, home) {
    const def = (PB.D.teamDef && PB.D.teamDef(team.id)) || team;
    const away = home === false;
    const side = (away ? def.away || def.home : def.home) || {};
    const u = Object.assign({}, side);
    u.jersey = u.jersey || (away ? "#b9bec6" : "#f6f5f0");
    u.pants = u.pants || u.jersey;
    u.number = u.number || def.main || "#222";
    u.wordColor = u.wordColor || u.number;
    u.under = side.under || def.under || def.cap || def.main || "#222";
    u.socks = side.socks || def.socks || u.under;
    u.belt = side.belt || def.belt || "#141414";
    u.buckle = side.buckle || def.buckle || "#b9bcc2";
    u.cap = Object.assign({ crown: def.cap || def.main || "#222", brim: def.cap || def.main || "#222", button: def.cap || "#222", markText: def.mark, markColor: def.sub || "#fff" }, def.capStyle || {}, side.cap || {});
    u.helmet = Object.assign({ color: u.cap.crown, markText: def.mark, markColor: def.sub || "#fff" }, def.helmet || {}, side.helmet || {});
    u.away = away;
    u.def = def;
    return u;
  }

  /* ---------- 布の実寸表 (テクスチャ座標 ↔ cm) ----------
   * 行 v ごとに「u を等分した各点までの布に沿った長さ (m)」を持つ。胴体は build_player.py の torsoArc、袖・パンツは読み込み時に同じ計算で作る。
   * 胴体の u は角度で切ってあるので胸の中央と脇では 1 u あたりの長さが違う (文字を px で描くと胸で 1.3〜1.4 倍横に伸びる)。
   * 文字や縞はこの表で cm → u に直して描く */
  const SC = {};
  function arcTable(geo, rows, u0, u1, nb) {
    const pos = geo.getAttribute("position").array;
    const uv = geo.getAttribute("uv").array;
    const idx = geo.getIndex().array;
    const span = u1 - u0;
    const out = [];
    for (const v0 of rows) {
      const dens = new Float64Array(nb);
      for (let t = 0; t < idx.length; t += 3) {
        const P = [];
        for (let e = 0; e < 3; e++) {
          const i = idx[t + e];
          const j = idx[t + ((e + 1) % 3)];
          const vi = uv[i * 2 + 1];
          const vj = uv[j * 2 + 1];
          if ((vi - v0) * (vj - v0) < 0) {
            const k = (v0 - vi) / (vj - vi);
            P.push([uv[i * 2] + k * (uv[j * 2] - uv[i * 2]), pos[i * 3] + k * (pos[j * 3] - pos[i * 3]), pos[i * 3 + 1] + k * (pos[j * 3 + 1] - pos[i * 3 + 1]), pos[i * 3 + 2] + k * (pos[j * 3 + 2] - pos[i * 3 + 2])]);
          }
        }
        if (P.length !== 2) continue;
        let a = P[0];
        let b = P[1];
        if (b[0] < a[0]) {
          a = P[1];
          b = P[0];
        }
        const du = b[0] - a[0];
        if (du < 1e-9 || du > 0.5 || a[0] < u0 - 1e-6 || b[0] > u1 + 1e-6) continue;
        const seg = Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);
        const ua = ((a[0] - u0) / span) * nb;
        const ub = ((b[0] - u0) / span) * nb;
        for (let k = Math.max(0, Math.floor(ua)); k <= Math.floor(ub) && k < nb; k++) {
          const lo = Math.max(ua, k);
          const hi = Math.min(ub, k + 1);
          if (hi > lo) dens[k] += (seg * (hi - lo)) / (ub - ua);
        }
      }
      const s = [0];
      for (let k = 0; k < nb; k++) s.push(s[k] + dens[k]);
      out.push(s);
    }
    return out;
  }
  // rows: 行の v, s: 行ごとの累積長 (m), u0..u1: 表が受け持つ u の範囲, mPerV: 縦 1 v の長さ (m)
  function makeScale(rows, s, u0, u1, mPerV) {
    const nb = s[0].length - 1;
    const full = u1 - u0 > 0.999; // 胴体: 1 周つながっている
    const total = s.map((r) => r[nb]);
    const sc = { rows, s, u0, u1, nb, mPerV, total, full };
    const at = (r, u) => {
      const k = Math.min(Math.max(((u - u0) / (u1 - u0)) * nb, 0), nb);
      const i = Math.min(nb - 1, Math.floor(k));
      return r[i] + (r[i + 1] - r[i]) * (k - i);
    };
    const rowOf = (v) => {
      const n = rows.length;
      if (v <= rows[0]) return [0, 0, 0];
      if (v >= rows[n - 1]) return [n - 1, n - 1, 0];
      let i = 0;
      while (rows[i + 1] < v) i++;
      return [i, i + 1, (v - rows[i]) / (rows[i + 1] - rows[i])];
    };
    // (v, u) の布に沿った長さ (m)。胴体では u が 0..1 の外なら 1 周分を足し引きする
    sc.arc = (v, u) => {
      let wrap = 0;
      if (full) {
        while (u < u0) {
          u += 1;
          wrap -= 1;
        }
        while (u > u1) {
          u -= 1;
          wrap += 1;
        }
      }
      const rw = rowOf(v);
      const a = rw[0];
      const b = rw[1];
      const w = rw[2];
      return at(s[a], u) * (1 - w) + at(s[b], u) * w + wrap * (total[a] * (1 - w) + total[b] * w);
    };
    // 長さ → u (単調増加の表を二分探索)。範囲外は胴体なら折り返し、袖・パンツなら NaN
    const inv = (r, target) => {
      let wrap = 0;
      const tot = r[nb];
      if (full && tot > 0) {
        while (target > tot) {
          target -= tot;
          wrap += 1;
        }
        while (target < 0) {
          target += tot;
          wrap -= 1;
        }
      } else if (target < -1e-9 || target > tot + 1e-9) return NaN;
      let lo = 0;
      let hi = nb;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (r[m] <= target) lo = m;
        else hi = m;
      }
      const f = r[hi] > r[lo] ? (target - r[lo]) / (r[hi] - r[lo]) : 0.5;
      return u0 + ((lo + f) / nb) * (u1 - u0) + wrap;
    };
    // 中心 uc から布に沿って d (m) 離れた点の u (右が +)
    sc.uAt = (v, uc, d) => {
      const rw = rowOf(v);
      const ua = inv(s[rw[0]], at(s[rw[0]], uc) + d);
      if (rw[0] === rw[1]) return ua;
      const ub = inv(s[rw[1]], at(s[rw[1]], uc) + d);
      return ua * (1 - rw[2]) + ub * rw[2];
    };
    // テクスチャの幅が S px のときの、(v, u) での横方向の px/cm と縦方向の px/cm
    sc.pxX = (v, u, S) => {
      const e = 0.5 / nb;
      const a = Math.max(u0, u - e);
      const b = Math.min(u1, u + e);
      const m = (sc.arc(v, b) - sc.arc(v, a)) / (b - a); // m per u
      return m > 1e-6 ? S / (m * 100) : S / 50;
    };
    sc.pxY = (S) => S / (mPerV * 100);
    return sc;
  }
  function prepScale() {
    const shirt = asset.geos.shirt;
    const uv = shirt.getAttribute("uv").array;
    const pos = shirt.getAttribute("position").array;
    const n = uv.length / 2;
    // 胴体: build_player.py の表があればそれを使う
    const ta = asset.extra.torsoArc;
    let torso;
    if (ta && ta.s && ta.s.length) torso = makeScale(ta.v, ta.s, 0, 1, (ta.y[1] - ta.y[0]) / 0.7);
    else {
      let lo = 9;
      let hi = -9;
      for (let i = 0; i < n; i++) if (uv[i * 2 + 1] > 0.335) {
        lo = Math.min(lo, pos[i * 3 + 1]);
        hi = Math.max(hi, pos[i * 3 + 1]);
      }
      const rows = [];
      for (let v = 0.4; v < 0.96; v += 0.05) rows.push(+v.toFixed(2));
      torso = makeScale(rows, arcTable(shirt, rows, 0, 1, 64), 0, 1, (hi - lo) / 0.66);
    }
    // 裾・袖口の v
    let hemV = 1;
    let cuffV = 1;
    for (let i = 0; i < n; i++) {
      const v = uv[i * 2 + 1];
      if (v > 0.335) hemV = Math.min(hemV, v);
      else if (v < 0.28) cuffV = Math.min(cuffV, v);
    }
    torso.hemV = hemV;
    // 袖: 腕の軸に沿った v の傾きから縦の実寸を出す
    const sleeve = {};
    for (const side of ["l", "r"]) {
      const A0 = RIG.B["upperarm_" + side];
      const ax = RIG.B["lowerarm_" + side].clone().sub(A0).normalize();
      const u0 = side === "l" ? 0 : 0.5;
      let sx = 0;
      let sy = 0;
      let sxx = 0;
      let sxy = 0;
      let m = 0;
      for (let i = 0; i < n; i++) {
        const u = uv[i * 2];
        const v = uv[i * 2 + 1];
        if (v >= 0.28 || u < u0 || u > u0 + 0.5 || pos[i * 3] * A0.x < 0) continue;
        const t = (pos[i * 3] - A0.x) * ax.x + (pos[i * 3 + 1] - A0.y) * ax.y + (pos[i * 3 + 2] - A0.z) * ax.z;
        sx += t;
        sy += v;
        sxx += t * t;
        sxy += t * v;
        m++;
      }
      const a = m > 2 ? (m * sxy - sx * sy) / (m * sxx - sx * sx) : -1.38;
      const rows = [];
      for (let v = 0.04; v < 0.275; v += 0.03) rows.push(+v.toFixed(2));
      sleeve[side] = makeScale(rows, arcTable(shirt, rows, u0, u0 + 0.5, 32), u0, u0 + 0.5, 1 / Math.max(0.2, Math.abs(a)));
      sleeve[side].cuffV = cuffV;
    }
    // パンツ (長い方の形で測る。短いパンツも同じテクスチャ)
    const pg = asset.geos.pantsL || asset.geos.pants;
    const prow = [];
    for (let v = 0.08; v < 0.99; v += 0.05) prow.push(+v.toFixed(2));
    const pants = {};
    for (const side of ["l", "r"]) {
      const u0 = side === "l" ? 0 : 0.5;
      pants[side] = makeScale(prow, arcTable(pg, prow, u0, u0 + 0.5, 32), u0, u0 + 0.5, asset.extra.beltY + 0.05);
    }
    SC.torso = torso;
    SC.sleeve = sleeve;
    SC.pants = pants;
    SC.vBelt = asset.extra.beltY / (asset.extra.beltY + 0.05);
  }
  // 確認用: 実寸表の要約
  H._scaleInfo = () => ({ torso: { mPerV: SC.torso.mPerV, hemV: SC.torso.hemV, circ: SC.torso.total }, sleeve: ["l", "r"].map((k) => ({ mPerV: SC.sleeve[k].mPerV, cuffV: SC.sleeve[k].cuffV, circ: SC.sleeve[k].total })), pants: ["l", "r"].map((k) => ({ mPerV: SC.pants[k].mPerV, circ: SC.pants[k].total })), vBelt: SC.vBelt });

  /* ---------- 文字・画像をワッペン (ツイル) 風に描く ----------
   * cm 単位のキャンバス (P px/cm) に描く。厚い縁取り + 縁の細い縫い目の線 + わずかな影 + 上が明るいサテンの光 */
  const FONT = (f) => "'" + (f || "Graduate") + "', 'Arial Black', sans-serif";
  const fontSpec = (f, px) => (FONT_WEIGHT[f] || 400) + " " + px + "px " + FONT(f);
  const CAP = {};
  // フォントの大文字の高さ (em に対する比)
  function capRatio(g, font) {
    const key = font + ":" + (document.fonts && document.fonts.check ? document.fonts.check(fontSpec(font, 40)) : "");
    if (CAP[key] != null) return CAP[key];
    g.save();
    g.font = fontSpec(font, 100);
    const m = g.measureText("H");
    g.restore();
    return (CAP[key] = m.actualBoundingBoxAscent ? m.actualBoundingBoxAscent / 100 : 0.72);
  }
  const fontPx = (g, font, capPx) => capPx / capRatio(g, font);
  // 縫い目の色: 明るい色は暗く、暗い色は明るく
  function stitch(col) {
    const c = new T.Color(col);
    const l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    return l > 0.45 ? "#" + c.multiplyScalar(0.62).getHexString() : "#" + c.lerp(new T.Color("#ffffff"), 0.35).getHexString();
  }
  // draw(mode): mode "stroke" / "fill" で同じ形を描くコールバック。st: { fill, outline, outlineMm, outline2, outline2Mm, boldMm, shadow }
  function applique(g, P, draw, st) {
    const mm = P / 10;
    const bold = (st.boldMm || 0) * mm;
    const o1 = st.outline ? (st.outlineMm || 2.5) * mm : 0;
    const o2 = st.outline && st.outline2 ? (st.outline2Mm || 2) * mm : 0;
    const W1 = bold + 2 * o1;
    const W2 = W1 + 2 * o2;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.miterLimit = 2;
    const stroke = (w, col) => {
      if (w <= 0.01) return;
      g.lineWidth = w;
      g.strokeStyle = col;
      draw("stroke");
    };
    if (st.shadow !== false) {
      g.save();
      g.translate(0.7 * mm, 1.1 * mm);
      stroke(Math.max(W2, bold) + 0.5 * mm, "rgba(0,0,0,0.32)");
      g.restore();
    }
    if (o2) {
      stroke(W2 + 0.7 * mm, stitch(st.outline2));
      stroke(W2, st.outline2);
    }
    if (o1) {
      stroke(W1 + 0.7 * mm, stitch(st.outline));
      stroke(W1, st.outline);
    }
    stroke(bold + 0.7 * mm, stitch(st.fill));
    stroke(bold, st.fill);
    g.fillStyle = st.fill;
    draw("fill");
  }
  // 上が明るく下が暗いサテンの光を、描いた所 (不透明な所) にだけ重ねる
  function sheen(g, x0, y0, w, h) {
    g.save();
    g.globalCompositeOperation = "source-atop";
    const gr = g.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, "rgba(255,255,255,0.20)");
    gr.addColorStop(0.45, "rgba(255,255,255,0.0)");
    gr.addColorStop(1, "rgba(0,0,0,0.14)");
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    g.restore();
  }
  // 文字。o: { cap (大文字の高さ cm), maxW (cm), font, fill, outline, outlineMm, outline2, outline2Mm, boldMm, italic (傾き), tilt (度: 右上がりは負), arch (度: 全体の角度), condense (最小の横つぶし) }
  function appliqueText(g, P, text, x, y, o) {
    if (!text) return 0;
    const sz0 = fontPx(g, o.font, o.cap * P);
    g.font = fontSpec(o.font, sz0);
    let m = g.measureText(text);
    const ink = (mm) => mm.actualBoundingBoxLeft + mm.actualBoundingBoxRight || mm.width;
    const maxW = (o.maxW || 1e9) * P;
    let sx = 1;
    let sz = sz0;
    if (ink(m) > maxW) {
      sx = maxW / ink(m);
      const cmin = o.condense || 0.72;
      if (sx < cmin) {
        sz = sz0 * (sx / cmin);
        sx = cmin;
      }
      g.font = fontSpec(o.font, sz);
      m = g.measureText(text);
    }
    const yOff = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; // 字面の中心を y に合わせる
    const w = ink(m);
    g.save();
    g.translate(x, y);
    if (o.tilt) g.rotate(o.tilt * D2R);
    if (o.italic) g.transform(1, 0, -o.italic, 1, 0, 0);
    g.scale(sx, 1);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    let draw;
    if (o.arch) {
      // アーチ: 文字ごとに円に沿って並べる (両端が下がる)
      const chars = [...text];
      const span = o.arch * D2R;
      const adv = chars.map((ch) => g.measureText(ch).width);
      const W = adv.reduce((a, b) => a + b, 0);
      const R = W / span;
      const sag = R * (1 - Math.cos(span / 2));
      draw = (mode) => {
        let a = -span / 2;
        chars.forEach((ch, i) => {
          a += (adv[i] / 2 / W) * span;
          g.save();
          g.translate(Math.sin(a) * R, R - Math.cos(a) * R - sag / 2);
          g.rotate(a);
          if (mode === "fill") g.fillText(ch, 0, yOff);
          else g.strokeText(ch, 0, yOff);
          g.restore();
          a += (adv[i] / 2 / W) * span;
        });
      };
    } else draw = (mode) => (mode === "fill" ? g.fillText(text, 0, yOff) : g.strokeText(text, 0, yOff));
    applique(g, P, draw, o);
    g.restore();
    const hh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const pad = 0.6 * P + hh * 0.3 + (Math.abs(Math.sin((o.tilt || 0) * D2R)) * w) / 2;
    sheen(g, x - (w * sx) / 2 - pad, y - hh / 2 - pad, w * sx + 2 * pad, hh + 2 * pad);
    return w * sx;
  }
  // 画像 (胸マークの写真の切り抜きなど)。cm の箱 maxW × maxH に収め、影と光を付ける
  function appliqueImage(g, P, url, x, y, maxW, maxH, tint) {
    const e = H.image(url);
    if (!e || !e.ok) return false;
    const im = e.img;
    const k = Math.min((maxW * P) / im.width, (maxH * P) / im.height);
    const w = im.width * k;
    const h = im.height * k;
    const tc = (col) => {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      const x2 = c.getContext("2d");
      x2.drawImage(im, 0, 0, c.width, c.height);
      x2.globalCompositeOperation = "source-in";
      x2.fillStyle = col;
      x2.fillRect(0, 0, c.width, c.height);
      return c;
    };
    g.drawImage(tc("rgba(0,0,0,0.32)"), x - w / 2 + 0.07 * P, y - h / 2 + 0.11 * P, w, h);
    if (tint) g.drawImage(tc(tint), x - w / 2, y - h / 2, w, h);
    else g.drawImage(im, x - w / 2, y - h / 2, w, h);
    sheen(g, x - w / 2 - P, y - h / 2 - P, w + 2 * P, h + 2 * P);
    return true;
  }
  // 組み合わせ文字 (HT / CD / YS / YB): 1 文字目の上に 2 文字目を重ね、重なりの縁を切り抜いて組んで見せる。
  // 配置: s2 = 2 文字目の大きさ (比), dx / dy = ずらし (1 文字目の幅・高さに対する比)
  const MONO = { HT: { s2: 0.96, dx: 0.0, dy: -0.12 }, CD: { s2: 0.74, dx: 0.4, dy: 0.02 }, YS: { s2: 0.82, dx: 0.3, dy: 0.14 }, YB: { s2: 0.82, dx: 0.3, dy: 0.14 }, BW: { s2: 0.82, dx: 0.3, dy: 0.14 } };
  function monogram(g, P, text, x, y, hCm, font, st) {
    if (text === "HT") return monogramHT(g, P, x, y, hCm, st);
    const a = text[0];
    const b = text.slice(1);
    const lay = MONO[text] || { s2: 0.8, dx: 0.3, dy: 0.12 };
    const sz = fontPx(g, font, hCm * P);
    g.font = fontSpec(font, sz);
    const w1 = g.measureText(a).width;
    const sz2 = sz * lay.s2;
    g.font = fontSpec(font, sz2);
    const w2 = g.measureText(b).width;
    // 全体の幅の中心を x に
    const left = -w1 / 2;
    const right = lay.dx * w1 + w2 / 2;
    const x1 = x - (left + right) / 2;
    const y1 = y;
    const x2 = x1 + lay.dx * w1;
    const y2 = y1 + lay.dy * hCm * P;
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    const yo = 0.1 * hCm * P; // middle 基準の字面のずれ
    g.font = fontSpec(font, sz);
    applique(g, P, (mode) => (mode === "fill" ? g.fillText(a, x1, y1 + yo) : g.strokeText(a, x1, y1 + yo)), st);
    // 2 文字目の縁を地の色で切る
    g.font = fontSpec(font, sz2);
    g.globalCompositeOperation = "destination-out";
    g.lineJoin = "round";
    g.lineWidth = ((st.outline ? 2 * (st.outlineMm || 2.5) : 0) + (st.boldMm || 0) + 2.2) * (P / 10);
    g.strokeStyle = "#000";
    g.strokeText(b, x2, y2 + yo * lay.s2);
    g.globalCompositeOperation = "source-over";
    applique(g, P, (mode) => (mode === "fill" ? g.fillText(b, x2, y2 + yo * lay.s2) : g.strokeText(b, x2, y2 + yo * lay.s2)), st);
    g.restore();
    sheen(g, x - (right - left) / 2 - P, y - hCm * P * 0.8, right - left + 2 * P, hCm * P * 1.6);
    return right - left;
  }
  // 阪神の "HT": H の上に T を載せた角ばったマーク (フォントでは T が H を隠すので、四角の組み合わせで描く)
  function monogramHT(g, P, x, y, hCm, st) {
    const h = hCm * P;
    const w = h * 1.0;
    const x0 = x - w / 2;
    const y0 = y - h / 2;
    const R = (ax, ay, bx, by) => g.rect(x0 + ax * w, y0 + ay * h, (bx - ax) * w, (by - ay) * h);
    const pathH = () => {
      g.beginPath();
      R(0.0, 0.0, 0.24, 1.0);
      R(0.76, 0.0, 1.0, 1.0);
      R(0.24, 0.42, 0.76, 0.58);
      R(-0.07, 0.9, 0.31, 1.0);
      R(0.69, 0.9, 1.07, 1.0);
      R(-0.07, 0.0, 0.31, 0.1);
      R(0.69, 0.0, 1.07, 0.1);
    };
    const pathT = () => {
      g.beginPath();
      R(-0.1, -0.02, 1.1, 0.24);
      R(0.385, 0.24, 0.615, 0.84);
      R(0.3, 0.76, 0.7, 0.84);
    };
    g.save();
    g.lineJoin = "miter";
    applique(g, P, (mode) => {
      pathH();
      if (mode === "fill") g.fill();
      else g.stroke();
    }, st);
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = ((st.outline ? 2 * (st.outlineMm || 2.5) : 0) + 2.4) * (P / 10);
    pathT();
    g.stroke();
    g.globalCompositeOperation = "source-over";
    applique(g, P, (mode) => {
      pathT();
      if (mode === "fill") g.fill();
      else g.stroke();
    }, st);
    g.restore();
    sheen(g, x0 - 0.15 * w, y0 - 0.1 * h, 1.3 * w, 1.2 * h);
    return w * 1.14;
  }
  // cm 単位の板 (P px/cm)。(ox, oy) が cm の原点
  function newPad(x0, x1, y0, y1, P) {
    const c = document.createElement("canvas");
    c.width = Math.ceil((x1 - x0) * P);
    c.height = Math.ceil((y1 - y0) * P);
    const g = c.getContext("2d", { willReadFrequently: true });
    return { c, g, P, ox: -x0 * P, oy: -y0 * P, X: (cm) => -x0 * P + cm * P, Y: (cm) => -y0 * P + cm * P };
  }
  // 板を布の実寸表に従って (uc, vc) を中心にテクスチャへ写す。縦横の比率が場所ごとに違うので 1 px ずつ写す
  // (横は ss 回サンプル、縦はバイリニア補間だけ)。板の不透明な範囲だけを写す
  function blitPanel(g, pad, sc, uc, vc, S, ss) {
    const src = pad.c;
    const W = src.width;
    const Hh = src.height;
    const P = pad.P;
    const sd = pad.g.getImageData(0, 0, W, Hh).data;
    let bx0 = W;
    let bx1 = -1;
    let by0 = Hh;
    let by1 = -1;
    for (let y = 0; y < Hh; y++) {
      let row = false;
      for (let x = 0, o = y * W * 4 + 3; x < W; x++, o += 4)
        if (sd[o] > 2) {
          if (x < bx0) bx0 = x;
          if (x > bx1) bx1 = x;
          row = true;
        }
      if (row) {
        if (y < by0) by0 = y;
        by1 = y;
      }
    }
    if (bx1 < 0) return;
    const mPerV = sc.mPerV;
    const k = 100 * P; // m → 板の px
    const vTop = vc + (pad.oy - by0 + 1) / k / mPerV;
    const vBot = vc - (by1 + 2 - pad.oy) / k / mPerV;
    const y0 = Math.max(0, Math.floor((1 - vTop) * S));
    const y1 = Math.min(S, Math.ceil((1 - vBot) * S));
    if (y1 <= y0) return;
    const dL = (bx0 - 1 - pad.ox) / k;
    const dR = (bx1 + 2 - pad.ox) / k;
    let uLo = Infinity;
    let uHi = -Infinity;
    for (const v of [vTop, vc, vBot]) {
      const a = sc.uAt(v, uc, dL);
      const b = sc.uAt(v, uc, dR);
      if (!isNaN(a)) uLo = Math.min(uLo, a);
      if (!isNaN(b)) uHi = Math.max(uHi, b);
    }
    if (!(uHi > uLo)) return;
    const x0 = Math.floor(uLo * S) - 1;
    const x1 = Math.ceil(uHi * S) + 1;
    if (x1 - x0 > S) return;
    const band = g.getImageData(0, y0, S, y1 - y0);
    const bd = band.data;
    const nb = sc.nb;
    const u0 = sc.u0;
    const span = sc.u1 - sc.u0;
    const rows = sc.rows;
    const R = new Float64Array(nb + 1); // この行の実寸表 (行の間を補間)
    for (let y = y0; y < y1; y++) {
      const v = 1 - (y + 0.5) / S;
      const py = pad.oy - (v - vc) * mPerV * k - 0.5;
      if (py < by0 - 1 || py > by1 + 1) continue;
      // 行の表
      let ia = 0;
      while (ia < rows.length - 2 && rows[ia + 1] < v) ia++;
      const w = Math.min(1, Math.max(0, (v - rows[ia]) / (rows[ia + 1] - rows[ia])));
      const ra = sc.s[ia];
      const rb = sc.s[ia + 1];
      for (let i = 0; i <= nb; i++) R[i] = ra[i] * (1 - w) + rb[i] * w;
      const total = R[nb];
      const arcAt = (u) => {
        let wrap = 0;
        if (sc.full) {
          while (u < u0) {
            u += 1;
            wrap -= 1;
          }
          while (u > u0 + span) {
            u -= 1;
            wrap += 1;
          }
        }
        const kk = Math.min(Math.max(((u - u0) / span) * nb, 0), nb);
        const i = Math.min(nb - 1, Math.floor(kk));
        return R[i] + (R[i + 1] - R[i]) * (kk - i) + wrap * total;
      };
      const ucArc = arcAt(uc);
      const iy = Math.max(0, Math.min(Hh - 2, Math.floor(py)));
      const fy = Math.min(1, Math.max(0, py - iy));
      const rowA = iy * W * 4;
      const rowB = rowA + W * 4;
      for (let x = x0; x <= x1; x++) {
        let r = 0;
        let gg = 0;
        let b = 0;
        let a = 0;
        for (let sx = 0; sx < ss; sx++) {
          const px = pad.ox + (arcAt((x + (sx + 0.5) / ss) / S) - ucArc) * k - 0.5;
          if (px < bx0 - 1 || px > bx1 + 1) continue;
          const ix = Math.max(0, Math.min(W - 2, Math.floor(px)));
          const fx = Math.min(1, Math.max(0, px - ix));
          const o00 = rowA + ix * 4;
          const o10 = o00 + 4;
          const o01 = rowB + ix * 4;
          const o11 = o01 + 4;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          const a00 = (sd[o00 + 3] / 255) * w00;
          const a10 = (sd[o10 + 3] / 255) * w10;
          const a01 = (sd[o01 + 3] / 255) * w01;
          const a11 = (sd[o11 + 3] / 255) * w11;
          r += sd[o00] * a00 + sd[o10] * a10 + sd[o01] * a01 + sd[o11] * a11;
          gg += sd[o00 + 1] * a00 + sd[o10 + 1] * a10 + sd[o01 + 1] * a01 + sd[o11 + 1] * a11;
          b += sd[o00 + 2] * a00 + sd[o10 + 2] * a10 + sd[o01 + 2] * a01 + sd[o11 + 2] * a11;
          a += a00 + a10 + a01 + a11;
        }
        if (a <= 1e-4) continue;
        const aa = a / ss;
        const xx = ((x % S) + S) % S;
        const o = ((y - y0) * S + xx) * 4;
        bd[o] = (r / a) * aa + bd[o] * (1 - aa);
        bd[o + 1] = (gg / a) * aa + bd[o + 1] * (1 - aa);
        bd[o + 2] = (b / a) * aa + bd[o + 2] * (1 - aa);
      }
    }
    g.putImageData(band, 0, y0);
  }
  // 織りのむら (決まった模様なので描き直しても同じ)
  let weave = null;
  function weavePattern(g) {
    if (!weave) {
      const N = 24;
      const c = document.createElement("canvas");
      c.width = c.height = N;
      const x = c.getContext("2d");
      const r = mulberry(7);
      for (let i = 0; i < N * N; i++) {
        x.fillStyle = "rgba(0,0,0," + (r() * 0.045).toFixed(3) + ")";
        x.fillRect(i % N, (i / N) | 0, 1, 1);
      }
      x.fillStyle = "rgba(255,255,255,0.05)";
      for (let y = 0; y < N; y += 2) for (let xx = y % 4 ? 0 : 2; xx < N; xx += 4) x.fillRect(xx, y, 2, 1);
      weave = c;
    }
    return g.createPattern(weave, "repeat");
  }
  // 胸マーク・番号などの既定の寸法 (cm)
  const CM = { wordDown: 15.5, scriptCap: 9, blockCap: 7, wordWidth: 32, numDown: 10.5, numSide: 10.5, numCap: 9, backNameDown: 8.5, backNameCap: 6.5, backNumCap: 25, backWidth: 30, pinstripe: 2.2, pinstripeMm: 1.5 };
  const isScript = (u) => u.wordStyle === "script" || (!u.wordStyle && /Yellowtail|Lobster|Oleo/.test(u.wordFont || ""));
  // 太さの足りないフォントは縁をなぞって太らせる
  const boldOf = (font) => (font === "Graduate" ? 1.6 : /Yellowtail|Lobster/.test(font || "") ? 1.2 : 0);

  // テクスチャ座標: 胴体は v=0.3..1 (キャンバスの上 70%), 袖は v=0..0.28 (下)。
  // u: 0.25 = 胸の中央, 0.75 = 背中の中央, 0 / 0.5 = 脇。袖は左袖 u 0..0.5 / 右袖 0.5..1、外側が x=S/4 (左袖), 3S/4 (右袖)
  function jerseyTexture(o) {
    const S = 512;
    const ss = o.low ? 1 : 2;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d", { willReadFrequently: true });
    const u = o.u;
    const tor = SC.torso;
    const slv = SC.sleeve;
    const vy = (v) => (1 - v) * S;
    const SLV = vy(0.28); // 袖の上端 (キャンバス y)
    g.fillStyle = u.jersey;
    g.fillRect(0, 0, S, S);
    g.fillStyle = weavePattern(g);
    g.fillRect(0, 0, S, S);
    // ベスト風: 袖をアンダーシャツの色に
    if (u.vest) {
      g.fillStyle = u.vest;
      g.fillRect(0, SLV, S, S - SLV);
    }
    // uc から布に沿って d0..d1 (m, 関数でも可) の帯を v0..v1 で多角形にして塗る
    const band = (sc, uc, d0, d1, v0, v1, col, step, vlo, vhi) => {
      const L = [];
      const R = [];
      for (let v = v0; v <= v1 + 1e-6; v += step || 0.02) {
        const vq = Math.min(Math.max(v, vlo != null ? vlo : -1), vhi != null ? vhi : 2);
        const a = sc.uAt(vq, uc, typeof d0 === "function" ? d0(v) : d0);
        const b = sc.uAt(vq, uc, typeof d1 === "function" ? d1(v) : d1);
        if (isNaN(a) || isNaN(b)) continue;
        L.push([a * S, vy(v)]);
        R.push([b * S, vy(v)]);
      }
      if (L.length < 2) return;
      g.fillStyle = col;
      g.beginPath();
      L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      R.reverse().forEach((p) => g.lineTo(p[0], p[1]));
      g.closePath();
      g.fill();
    };
    // uc を中心に sp (m) おきの縦じま (布の上で等間隔)。ua..ub の範囲だけ
    const stripes = (sc, uc, ua, ub, sp, v0, v1, vlo, vhi) => {
      g.save();
      g.beginPath();
      g.rect(ua * S, vy(v1), (ub - ua) * S, vy(v0) - vy(v1));
      g.clip();
      for (let k = -40; k <= 40; k++) {
        g.beginPath();
        let on = false;
        for (let v = v0; v <= v1 + 1e-6; v += 0.025) {
          const uu = sc.uAt(Math.min(Math.max(v, vlo), vhi), uc, k * sp);
          if (isNaN(uu) || uu < ua - 0.03 || uu > ub + 0.03) {
            on = false;
            continue;
          }
          if (on) g.lineTo(uu * S, vy(v));
          else g.moveTo(uu * S, vy(v));
          on = true;
        }
        g.stroke();
      }
      g.restore();
    };
    // 脇のパネル (中日): 脇の縫い目 (u 0 / 0.5 / 1) の両側 4 cm と袖の内側
    if (u.sidePanels) {
      const w = (u.sidePanelCm || 7) / 200;
      band(tor, 0.5, -w, w, 0.3, 0.8, u.sidePanels, 0.02, 0.4, 0.72);
      band(tor, 0, 0, w, 0.3, 0.8, u.sidePanels, 0.02, 0.4, 0.72);
      band(tor, 1, -w, 0, 0.3, 0.8, u.sidePanels, 0.02, 0.4, 0.72);
      for (const [sc, uc, sg] of [[slv.l, 0, 1], [slv.l, 0.5, -1], [slv.r, 0.5, 1], [slv.r, 1, -1]]) band(sc, uc, sg > 0 ? 0 : -w * 0.8, sg > 0 ? w * 0.8 : 0, 0.0, 0.2, u.sidePanels, 0.02, 0.08, 0.2);
    }
    // ピンストライプ: 前は胸の中央、後ろは背中の中央から等間隔。袖は腕に沿う向き
    if (u.pinstripe) {
      const sp = (u.pinstripeCm || CM.pinstripe) / 100;
      g.strokeStyle = u.pinstripe;
      g.lineWidth = Math.max(0.9, ((u.pinstripeMm || CM.pinstripeMm) / 10) * tor.pxX(0.6, 0.25, S));
      g.globalAlpha = 0.86;
      stripes(tor, 0.25, 0, 0.5, sp, 0.3, 1.0, 0.4, 0.72);
      stripes(tor, 0.75, 0.5, 1.0, sp, 0.3, 1.0, 0.4, 0.72);
      if (!u.vest) {
        stripes(slv.l, 0.25, 0, 0.5, sp, 0.0, 0.28, 0.1, 0.22);
        stripes(slv.r, 0.75, 0.5, 1.0, sp, 0.0, 0.28, 0.1, 0.22);
      }
      g.globalAlpha = 1;
    }
    // 脇のライン (横浜 2009 など)
    if (u.sideStripes) {
      const w = (u.sideStripeCm || 1.5) / 100;
      u.sideStripes.forEach((col, i) => {
        band(tor, 0.5, -w * (i + 1), -w * i, 0.3, 0.8, col, 0.02, 0.4, 0.72);
        band(tor, 0.5, w * i, w * (i + 1), 0.3, 0.8, col, 0.02, 0.4, 0.72);
        band(tor, 0, w * i, w * (i + 1), 0.3, 0.8, col, 0.02, 0.4, 0.72);
        band(tor, 1, -w * (i + 1), -w * i, 0.3, 0.8, col, 0.02, 0.4, 0.72);
      });
    }
    // 襟ぐりの点 (前立ての上端・背ネームの位置を決める)。u 順に並べて、ギザギザをならす
    const raw = (asset.extra.collarUV || []).filter((p) => p[1] > 0.5 && p[0] <= 1);
    raw.sort((a, b) => a[0] - b[0]);
    const col = raw.map((p, i) => {
      let sv = 0;
      let n = 0;
      for (let k = -3; k <= 3; k++) {
        const q = raw[(i + k + raw.length) % raw.length];
        sv += q[1];
        n++;
      }
      return [p[0], Math.max(p[1], sv / n)];
    });
    const nearest = (uc, dflt) => (col.length ? col.reduce((b, p) => (Math.abs(p[0] - uc) < Math.abs(b[0] - uc) ? p : b), col[0]) : dflt);
    const front = nearest(0.25, [0.25, 0.916]);
    const back = nearest(0.75, [0.75, 0.975]);
    const vCF = front[1];
    const cmV = (cm) => cm / (tor.mPerV * 100); // cm → v
    const vDown = (cm) => vCF - cmV(cm);
    const trimCols = u.piping || (u.vneck ? u.vneck : u.sleeveTrim ? [u.sleeveTrim[0]] : null);
    const fx = 0.25;
    const hemV = tor.hemV || 0.34;
    if (u.vneck) {
      // V ネック: 襟の前点から 7 cm 下の点へ向かう帯。外側の色から順に
      const depth = (u.vneckCm || 7) / 100;
      const half = 0.075;
      const n = u.vneck.length;
      const ww = 0.013 * 1.3; // 斜めなので横幅は広め
      const vBot = vCF - depth / tor.mPerV;
      u.vneck.forEach((cc, i) => {
        for (const sg of [-1, 1]) {
          const d = (v) => sg * ((half * (v - vBot)) / (vCF - vBot) + (n - i - 1) * ww);
          const d2 = (v) => sg * ((half * (v - vBot)) / (vCF - vBot) + (n - i) * ww);
          band(tor, fx, sg > 0 ? d : d2, sg > 0 ? d2 : d, vBot - ww / tor.mPerV, vCF + 0.01, cc, 0.01, 0.4, 0.9);
        }
      });
    } else {
      // 前立て (折り目の影・パイピング・ボタン)。幅 3.5 cm
      const half = 0.0175;
      band(tor, fx, half - 0.0015, half + 0.0008, hemV, vCF + 0.005, "rgba(0,0,0,0.16)", 0.02, 0.4, 0.9);
      band(tor, fx, half - 0.0035, half - 0.0015, hemV, vCF + 0.005, "rgba(255,255,255,0.22)", 0.02, 0.4, 0.9);
      if (u.piping) {
        const w = (u.pipingMm || 5) / 1000;
        let off = half;
        u.piping.forEach((cc) => {
          band(tor, fx, off, off + w, hemV, vCF + 0.005, cc, 0.02, 0.4, 0.9);
          band(tor, fx, -off - w, -off, hemV, vCF + 0.005, cc, 0.02, 0.4, 0.9);
          off += w;
        });
      }
      // ボタン (13 mm) 襟から 4 cm 下、8.5 cm おき
      const len = (vCF - hemV) * tor.mPerV * 100;
      for (let cm = 4; cm < len - 3; cm += 8.5) {
        const v = vDown(cm);
        const y = vy(v);
        const x = fx * S;
        const rx = 0.65 * tor.pxX(v, fx, S);
        const ry = 0.65 * tor.pxY(S);
        g.beginPath();
        g.ellipse(x + 0.6, y + 0.9, rx, ry, 0, 0, Math.PI * 2);
        g.fillStyle = "rgba(0,0,0,0.28)";
        g.fill();
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        g.fillStyle = u.buttonColor || "#f3f1ea";
        g.fill();
        g.lineWidth = 0.8;
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.stroke();
        g.fillStyle = "rgba(0,0,0,0.4)";
        for (const dx of [-0.35, 0.35]) {
          g.beginPath();
          g.ellipse(x + dx * rx, y, rx * 0.16, ry * 0.16, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    /* --- 胸: マーク (画像 / 筆記体 / ブロック体 / 組み合わせ文字 + 文字) と番号を cm の板に描いて布へ写す --- */
    const P = 8; // 板の px/cm
    const front_ = newPad(-23, 23, -9, 19, P);
    const fg = front_.g;
    const script = isScript(u);
    const wordSt = { fill: u.wordColor, outline: u.wordOutline, outlineMm: u.wordOutlineMm, outline2: u.wordOutline2, outline2Mm: u.wordOutline2Mm, boldMm: u.wordBoldMm != null ? u.wordBoldMm : boldOf(u.wordFont), font: u.wordFont || "Graduate" };
    const wordCap = u.wordCm || (script ? CM.scriptCap : CM.blockCap);
    const wordW = u.wordWidthCm || CM.wordWidth;
    const numSt = { fill: u.number, outline: u.numberOutline, outlineMm: u.numberOutlineMm, outline2: u.numberOutline2, boldMm: u.numberBoldMm != null ? u.numberBoldMm : boldOf(u.numberFont || "Graduate"), font: u.numberFont || "Graduate" };
    const num = o.num != null ? String(o.num) : "";
    const side = u.frontNumberSide === "left" ? -1 : 1; // 胸番号: 既定は選手の左胸 (テクスチャでは +u)
    const numSide = u.frontNumberSideCm || CM.numSide;
    if (u.wordSmall) {
      // 小さなマークは番号の反対側の胸に (既定: 番号が選手の左、マークが右)。frontNumberSide "left" なら逆
      const cx = front_.X(-side * numSide * 0.9);
      if (!(u.word && appliqueImage(fg, P, u.word, cx, front_.Y(0), u.wordWidthCm || 9, u.wordCm || 8, u.wordTint))) {
        if (u.wordMono) monogram(fg, P, u.wordMono, cx, front_.Y(0), u.wordCm || 7, wordSt.font, wordSt);
        else appliqueText(fg, P, u.wordText || o.team.mark || "", cx, front_.Y(0), Object.assign({ cap: u.wordCm || 7, maxW: 10 }, wordSt));
      }
      if (u.frontNumber !== false && num) appliqueText(fg, P, num, front_.X(side * numSide * 0.9), front_.Y(0), Object.assign({ cap: u.frontNumberCm || CM.numCap, maxW: 12 }, numSt));
    } else {
      let drawn = false;
      if (u.word) drawn = appliqueImage(fg, P, u.word, front_.X(0), front_.Y(0), wordW, u.wordCm || 12, u.wordTint);
      if (!drawn) {
        const text = u.wordText || o.team.en || "";
        const o2 = Object.assign({ cap: wordCap, maxW: wordW, tilt: u.wordTilt != null ? u.wordTilt : script ? -7 : 0, italic: u.wordItalic || 0, arch: u.wordArch || (u.arch ? 28 : 0), condense: 0.75 }, wordSt);
        if (u.wordMono) {
          // 組み合わせ文字 + 続きの文字 (中日 "CD"+"RAGONS")
          fg.font = fontSpec(wordSt.font, fontPx(fg, wordSt.font, wordCap * P));
          const tw = Math.min(fg.measureText(text).width, (wordW - wordCap * 1.5) * P);
          const mw = wordCap * 1.45 * P;
          const x0 = front_.X(0) - (mw + tw) / 2;
          monogram(fg, P, u.wordMono, x0 + mw / 2, front_.Y(-0.4), wordCap * 1.45, wordSt.font, wordSt);
          appliqueText(fg, P, text, x0 + mw + tw / 2 + 0.2 * P, front_.Y(0), Object.assign(o2, { maxW: tw / P, tilt: 0 }));
        } else {
          appliqueText(fg, P, text, front_.X(0), front_.Y(0), o2);
          if (u.wordSwash && script) swash(fg, P, front_.X(0), front_.Y(0), wordCap, wordW * 0.92, o2.tilt, wordSt);
        }
      }
      // 胸番号: マークの下、左胸 (選手の左) に寄せる
      if (u.frontNumber !== false && num) appliqueText(fg, P, num, front_.X(side * numSide), front_.Y(u.frontNumberDownCm || CM.numDown), Object.assign({ cap: u.frontNumberCm || CM.numCap, maxW: 13 }, numSt));
    }
    const vWord = vDown(u.wordDownCm || CM.wordDown);
    blitPanel(g, front_, tor, fx, vWord, S, ss);
    /* --- 背中: 背ネーム (6.5 cm, ゆるいアーチ) と背番号 (25 cm) --- */
    const bx = 0.75;
    const back_ = newPad(-20, 20, -6, 34, P);
    const bg = back_.g;
    const hasName = u.backName !== false && !!o.nameEn;
    const nameFont = u.backNameFont || numSt.font;
    if (hasName) appliqueText(bg, P, String(o.nameEn).toUpperCase(), back_.X(0), back_.Y(0), { cap: u.backNameCm || CM.backNameCap, maxW: CM.backWidth, font: nameFont, fill: numSt.fill, outline: numSt.outline, outlineMm: 1.5, outline2: numSt.outline2, outline2Mm: 1.2, boldMm: boldOf(nameFont), arch: u.backNameArch != null ? u.backNameArch : 14, condense: 0.7 });
    const backNum = u.backNumberCm || CM.backNumCap;
    const numY = hasName ? (u.backNameCm || CM.backNameCap) / 2 + 2.5 + backNum / 2 : backNum / 2 - 2.5;
    if (num) appliqueText(bg, P, num, back_.X(0), back_.Y(numY), Object.assign({ cap: backNum, maxW: CM.backWidth, condense: 0.7, outlineMm: 3, outline2Mm: 2.5 }, numSt, { boldMm: boldOf(numSt.font) * 1.5 }));
    blitPanel(g, back_, tor, bx, back[1] - cmV(u.backNameDownCm || CM.backNameDown), S, ss);
    /* --- 袖 --- */
    for (const sd of ["l", "r"]) {
      const sc = slv[sd];
      const cx = sd === "l" ? S * 0.25 : S * 0.75;
      const uc = sd === "l" ? 0.25 : 0.75;
      const pxY = sc.pxY(S);
      // 袖口のライン: 袖口から 6 mm 上に、幅 sleeveTrimMm (既定 12 mm) ずつ 4 mm あけて重ねる
      if (u.sleeveTrim && !u.vest) {
        let mm = 6;
        u.sleeveTrim.forEach((cc, i) => {
          const w = (u.sleeveTrimMm && u.sleeveTrimMm[i]) || (u.sleeveTrim.length > 2 ? 7 : 12);
          const v0 = sc.cuffV + mm / 1000 / sc.mPerV;
          const v1 = sc.cuffV + (mm + w) / 1000 / sc.mPerV;
          g.fillStyle = cc;
          g.fillRect(sd === "l" ? 0 : S / 2, vy(v1), S / 2, vy(v0) - vy(v1));
          mm += w + 3;
        });
      }
      // ワッペン・袖の文字・組み合わせ文字 (左袖が既定)
      const want = (side_) => (side_ || "L").toUpperCase() === (sd === "l" ? "L" : "R");
      const vPatch = 0.28 - (u.sleevePatchDownCm || 7.5) / 100 / sc.mPerV;
      const pxX = sc.pxX(vPatch, uc, S);
      const cy = vy(vPatch);
      const draw = (fn) => {
        const pad = newPad(-7, 7, -7, 7, P);
        fn(pad);
        g.save();
        g.translate(cx, cy);
        g.scale(pxX / P, pxY / P);
        g.drawImage(pad.c, -pad.ox, -pad.oy);
        g.restore();
      };
      if (u.sleevePatch && want(u.sleevePatchSide)) draw((pad) => appliqueImage(pad.g, P, u.sleevePatch, pad.X(0), pad.Y(0), u.sleevePatchCm || 8, u.sleevePatchCm || 8));
      if (u.sleeveWord && want(u.sleeveWordSide)) draw((pad) => appliqueImage(pad.g, P, u.sleeveWord, pad.X(0), pad.Y(0), u.sleeveWordCm || 11, 6, u.sleeveWordTint));
      if (u.sleeveMono && want(u.sleeveMonoSide)) draw((pad) => monogram(pad.g, P, u.sleeveMono, pad.X(0), pad.Y(0), u.sleeveMonoCm || 5, wordSt.font, Object.assign({}, wordSt, { boldMm: 0 })));
      if (u.sleeveText && want(u.sleeveTextSide)) {
        // 腕に沿って肩から袖口へ読む (左袖は時計回りに 90°)
        const pad = newPad(-8, 8, -3, 3, P);
        appliqueText(pad.g, P, u.sleeveText, pad.X(0), pad.Y(0), Object.assign({ cap: u.sleeveTextCm || 2.6, maxW: 15, condense: 0.8 }, wordSt, { boldMm: 0, outlineMm: 1.2 }));
        g.save();
        g.translate(cx, vy(0.28 - 0.09 / sc.mPerV));
        g.rotate((sd === "l" ? 1 : -1) * Math.PI / 2);
        g.scale(pxY / P, pxX / P);
        g.drawImage(pad.c, -pad.ox, -pad.oy);
        g.restore();
      }
      if (u.stars) {
        g.save();
        g.translate(cx, vy(0.262));
        g.scale(pxX / P, pxY / P);
        star(g, 0, 0, 2.2 * P, u.stars);
        g.restore();
      }
    }
    collarBand(g, S, u.jersey, trimCols, !!u.vneck);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = o.low ? 2 : 8;
    return t;
  }
  // 筆記体の下の飾り線 (Yokohama / Buffaloes): 最後の文字の下から左へ伸びて細くなる
  function swash(g, P, x, y, cap, w, tilt, st) {
    g.save();
    g.translate(x, y);
    g.rotate((tilt || 0) * D2R);
    const W = w * P;
    const y0 = cap * P * 0.62;
    const path = () => {
      g.beginPath();
      g.moveTo(W * 0.48, y0 - cap * P * 0.18);
      g.quadraticCurveTo(W * 0.46, y0 + cap * P * 0.1, W * 0.12, y0 + cap * P * 0.06);
      g.lineTo(-W * 0.42, y0 - cap * P * 0.02);
      g.lineTo(W * 0.12, y0 - cap * P * 0.06);
      g.quadraticCurveTo(W * 0.36, y0 - cap * P * 0.08, W * 0.48, y0 - cap * P * 0.18);
      g.closePath();
    };
    applique(g, P, (mode) => {
      path();
      if (mode === "fill") g.fill();
      else g.stroke();
    }, Object.assign({}, st, { boldMm: 0.6 }));
    g.restore();
  }
  function star(g, x, y, r, col) {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  // 襟の帯: build_player.py が襟ぐりに足した折り返しの帯 (表 → 縁 → 裏)。
  // テクスチャでは裾の下 (パンツに隠れる所) の横長の行に、縁からの距離 (mm) ごとの横じまとして描く
  function collarBand(g, S, base, trimCols, vneck) {
    const cb = asset.extra.collarBand;
    if (!cb) return;
    const vOf = (mm) => (mm >= 0 ? cb.vEdge + (cb.vOut - cb.vEdge) * Math.min(1.1, mm / cb.mmOut) : cb.vEdge + (cb.vIn - cb.vEdge) * Math.min(1.1, -mm / cb.mmIn));
    const band = (a, b, col) => {
      const y0 = (1 - vOf(a)) * S;
      const y1 = (1 - vOf(b)) * S;
      g.fillStyle = col;
      g.fillRect(0, Math.min(y0, y1), S, Math.abs(y1 - y0));
    };
    band(cb.mmOut * 1.1, 0, base);
    band(0, -cb.mmIn * 1.1, shade(base, 0.82)); // 裏地は少し暗く
    if (vneck && trimCols && trimCols.length) {
      // V ネックのリブ: 外側の色を広く、縁の側に 2 色目
      band(cb.mmOut * 1.1, 5, trimCols[0]);
      band(5, -cb.mmIn * 1.1, trimCols[1] || trimCols[0]);
      band(cb.mmOut * 1.1 - 0.8, cb.mmOut * 1.1, shade(trimCols[0], 0.75));
    } else if (trimCols && trimCols.length) {
      // 1 色目は縁を包むパイピング、2 色目からは外側に並ぶ細い線
      const w = trimCols.length > 1 ? 2.6 : 4.2;
      band(-3.6, 1.9 + w, trimCols[0]);
      for (let i = 1; i < trimCols.length; i++) band(1.9 + w * i, 1.9 + w * (i + 1), trimCols[i]);
    } else {
      // 縁取りのない襟: 縫い目の影だけ
      band(5.6, 6.4, shade(base, 0.8));
    }
  }
  function shade(col, k) {
    return "#" + new T.Color(col).multiplyScalar(k).getHexString();
  }
  const pantsCache = {};
  // パンツ: 左脚 u=0..0.5 (内側 0, 正面 1/8, 外側 1/4, 後ろ 3/8), 右脚 0.5..1 (外側 0.5 と 1, 正面 5/8, 内側 3/4, 後ろ 7/8)。
  // 球団・ホーム/ビジターごとに共有。ベルト (バックル付き) もここに描く
  function pantsTexture(u, low) {
    const key = [low ? 1 : 0, u.pants, u.pantsPinstripe, u.pantsPinstripeCm, (u.pantsPiping || []).join(), u.pantsPipingMm, u.pantsText, u.number, u.belt, u.buckle].join("|");
    if (pantsCache[key]) return pantsCache[key];
    const S = low ? 256 : 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const vy = (v) => (1 - v) * S;
    const pl = SC.pants.l;
    const pr = SC.pants.r;
    g.fillStyle = u.pants;
    g.fillRect(0, 0, S, S);
    g.fillStyle = weavePattern(g);
    g.fillRect(0, 0, S, S);
    const band = (sc, uc, d0, d1, v0, v1, col) => {
      const L = [];
      const R = [];
      for (let v = v0; v <= v1 + 1e-6; v += 0.03) {
        const vq = Math.min(Math.max(v, 0.45), 0.72);
        const a = sc.uAt(vq, uc, d0);
        const b = sc.uAt(vq, uc, d1);
        if (isNaN(a) || isNaN(b)) continue;
        L.push([a * S, vy(v)]);
        R.push([b * S, vy(v)]);
      }
      if (L.length < 2) return;
      g.fillStyle = col;
      g.beginPath();
      L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      R.reverse().forEach((p) => g.lineTo(p[0], p[1]));
      g.closePath();
      g.fill();
    };
    if (u.pantsPinstripe) {
      const sp = (u.pantsPinstripeCm || CM.pinstripe) / 100;
      g.strokeStyle = u.pantsPinstripe;
      g.lineWidth = Math.max(0.9, 0.15 * pl.pxX(0.7, 0.125, S));
      g.globalAlpha = 0.86;
      // 脚ごとに正面と後ろの中央から等間隔。継ぎ目 (内側・外側) で切る
      for (const [sc, cf, cb, a, m, b] of [[pl, 0.125, 0.375, 0, 0.25, 0.5], [pr, 0.625, 0.875, 0.5, 0.75, 1]]) {
        for (const [uc, ua, ub] of [[cf, a, m], [cb, m, b]]) {
          g.save();
          g.beginPath();
          g.rect(ua * S, 0, (ub - ua) * S, S);
          g.clip();
          for (let k = -30; k <= 30; k++) {
            g.beginPath();
            let on = false;
            for (let v = 0.0; v <= 1.0; v += 0.04) {
              const uu = sc.uAt(Math.min(Math.max(v, 0.45), 0.72), uc, k * sp);
              if (isNaN(uu) || uu < ua - 0.03 || uu > ub + 0.03) {
                on = false;
                continue;
              }
              if (on) g.lineTo(uu * S, vy(v));
              else g.moveTo(uu * S, vy(v));
              on = true;
            }
            g.stroke();
          }
          g.restore();
        }
      }
      g.globalAlpha = 1;
    }
    // 脇のライン: 外側の縫い目だけ (左脚 u 0.25、右脚 u 0.5 と 1.0)
    if (u.pantsPiping) {
      const w = (u.pantsPipingMm || 12) / 1000;
      let off = 0;
      u.pantsPiping.forEach((cc) => {
        band(pl, 0.25, off, off + w, 0, 1, cc);
        band(pl, 0.25, -off - w, -off, 0, 1, cc);
        band(pr, 0.5, off, off + w, 0, 1, cc);
        band(pr, 1, -off - w, -off, 0, 1, cc);
        off += w;
      });
    }
    if (u.pantsText) {
      // 左脚の外側、腰の下に腕に沿う向きの小さな文字
      const P = 8;
      const pad = newPad(-8, 8, -2.5, 2.5, P);
      appliqueText(pad.g, P, u.pantsText, pad.X(0), pad.Y(0), { cap: 2.5, maxW: 15, font: "Graduate", fill: u.number, boldMm: 1.2, condense: 0.8 });
      g.save();
      g.translate(S * 0.25, vy(0.8));
      g.rotate(-Math.PI / 2);
      g.scale(pl.pxY(S) / P, pl.pxX(0.8, 0.25, S) / P);
      g.drawImage(pad.c, -pad.ox, -pad.oy);
      g.restore();
    }
    // ベルト: 4 cm 幅、上に光の線、下に影。ベルト通し (1 cm, パンツの色) と正面のバックル (3 × 3.5 cm)
    const vB = SC.vBelt;
    const bt = vB + 0.015 / pl.mPerV;
    const bb = vB - 0.025 / pl.mPerV;
    g.fillStyle = u.belt;
    g.fillRect(0, vy(bt), S, vy(bb) - vy(bt));
    g.fillStyle = "rgba(255,255,255,0.16)";
    g.fillRect(0, vy(bt), S, Math.max(1, S / 256));
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(0, vy(bb) - Math.max(1, S / 256), S, Math.max(1, S / 256));
    const loopCol = shade(u.pants, 0.93);
    for (const [sc, uc] of [[pl, 0.125], [pl, 0.25], [pl, 0.375], [pr, 0.625], [pr, 0.75], [pr, 0.875]]) {
      const a = sc.uAt(vB, uc, -0.005);
      const b = sc.uAt(vB, uc, 0.005);
      if (isNaN(a) || isNaN(b)) continue;
      g.fillStyle = loopCol;
      g.fillRect(a * S, vy(bt) - 1, (b - a) * S, vy(bb) - vy(bt) + 2);
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(a * S, vy(bt) - 1, 1, vy(bb) - vy(bt) + 2);
      g.fillRect(b * S - 1, vy(bt) - 1, 1, vy(bb) - vy(bt) + 2);
    }
    // バックル: 左脚の内側の縫い目 (u 0) と右脚の内側 (u 0.75) にまたがる
    const bw = 0.03;
    const bh = 0.035;
    const by0 = vy(vB + bh / 2 / pl.mPerV);
    const by1 = vy(vB - bh / 2 / pl.mPerV);
    const buckle = (x0, x1) => {
      g.fillStyle = shade(u.buckle, 0.55);
      g.fillRect(x0, by0, x1 - x0, by1 - by0);
      g.fillStyle = u.buckle;
      g.fillRect(x0 + 1, by0 + 1, x1 - x0 - 2, by1 - by0 - 2);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(x0 + 1, by0 + 1, x1 - x0 - 2, 1);
    };
    const lb = pl.uAt(vB, 0, bw / 2);
    const rb = pr.uAt(vB, 0.75, -bw / 2);
    if (!isNaN(lb)) buckle(0, lb * S);
    if (!isNaN(rb)) buckle(rb * S, 0.75 * S);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = low ? 2 : 4;
    t.userData.shared = true;
    pantsCache[key] = t;
    return t;
  }
  // 帽子・ヘルメットのマーク (正方形のキャンバス)。画像 / 文字 / 組み合わせ文字 (markStyle "mono")
  function markCanvas(m) {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    if (m.mark) {
      const P = S / 5.2; // 5 cm の正方形いっぱいに
      if (appliqueImage(g, P, m.mark, S / 2, S / 2, 4.9, 4.9, m.markTint)) return { c, k: 1 };
    }
    const txt = m.markText || "";
    if (!txt) return null;
    const P = S / 5;
    const st = { fill: m.markColor || "#fff", outline: m.markOutline || null, outlineMm: 1.6, boldMm: boldOf(m.markFont || "Graduate"), font: m.markFont || "Graduate" };
    if (m.markStyle === "mono" && txt.length >= 2) monogram(g, P, txt, S / 2, S / 2, 3.6, st.font, st);
    else appliqueText(g, P, txt, S / 2, S / 2, Object.assign({ cap: txt.length > 1 ? 3.0 : 3.9, maxW: 4.8, condense: 0.8 }, st));
    // 文字は四角の中で小さく見えるので、ひとまわり大きく貼る
    return { c, k: 1.25 };
  }
  H._markCanvas = markCanvas;
  H._dbg = { appliqueText, newPad, monogram, jerseyTexture, pantsTexture, uniformOf };
  // 帽子のクラウン・ヘルメットの殻: u = 頭のまわり (0.5 が正面), v = 縁 0 → てっぺん 1 (build_player.py の dome_uv)。
  // マークは正面のパネルに描き込む (浮いた板にしないので、浅い帽子でも形からはみ出さない)。球団ごとに共有する
  const domeCache = {};
  function domeTexture(kind, base, m, stripes, low) {
    const L = asset.extra[kind === "helmet" ? "helmetLogo" : "capLogo"];
    // 画質 low では半分の解像度
    const W = low ? 512 : 1024;
    const Hc = W / 4;
    const key = [kind, W, base, stripes || "", m.mark || "", m.markTint || "", m.markText || "", m.markStyle || "", m.markColor || "", m.markFont || "", m.markOutline || ""].join("|");
    if (domeCache[key]) return domeCache[key];
    const c = document.createElement("canvas");
    c.width = W;
    c.height = Hc;
    const g = c.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, W, Hc);
    const vy = (v) => (1 - v) * Hc;
    if (stripes) {
      // タテじま (てっぺんへ集まる所は描かない)
      g.fillStyle = stripes;
      for (let k = 0; k < 16; k++) g.fillRect(((0.5 + k / 16) % 1) * W - W / 170, vy(0.9), W / 85, Hc);
    }
    if (kind !== "helmet") {
      // 6 枚はぎの縫い目 (正面の中央にも 1 本) と、パネルごとの通気穴
      g.strokeStyle = "rgba(0,0,0,0.28)";
      g.lineWidth = W / 512;
      for (let k = 0; k < 6; k++) {
        const x = ((0.5 + k / 6) % 1) * W;
        g.beginPath();
        g.moveTo(x, vy(0.97));
        g.lineTo(x, Hc);
        g.stroke();
        for (const dx of [-1 / 24, 1 / 24]) {
          const ex = ((0.5 + k / 6 + 1 / 12 + dx) % 1) * W;
          g.beginPath();
          g.ellipse(ex, vy(0.74), W / 300, Hc / 60, 0, 0, Math.PI * 2);
          g.fillStyle = "rgba(0,0,0,0.5)";
          g.fill();
        }
      }
      // 縁のステッチ
      g.strokeStyle = "rgba(0,0,0,0.22)";
      g.beginPath();
      g.moveTo(0, vy(0.03));
      g.lineTo(W, vy(0.03));
      g.stroke();
    }
    const mk = L && markCanvas(m);
    if (mk) {
      // 表面に沿った大きさ (h [m] の正方形) をテクスチャの縦横に直す
      const mw = L.h * mk.k * L.su * W;
      const mh = L.h * mk.k * L.sv * Hc;
      g.drawImage(mk.c, L.u * W - mw / 2, vy(L.v) - mh / 2, mw, mh);
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = T.RepeatWrapping;
    t.anisotropy = 4;
    t.userData.shared = true;
    // 画像がまだ読めていないときは共有しない (次の選手で描き直す)
    const im = m.mark ? H.image(m.mark) : null;
    if (!im || im.ok) domeCache[key] = t;
    else t.userData.shared = false;
    return t;
  }
  // 布の編み目 (法線マップ, 繰り返し)。遠目にはつやの違いとしてだけ見える
  let knitTex = null;
  function knitNormal() {
    if (knitTex) return knitTex;
    const N = 64;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d");
    const id = g.createImageData(N, N);
    const d = id.data;
    const h = (x, y) => 0.5 + 0.22 * Math.sin((x / N) * Math.PI * 2 * 8) * Math.sin((y / N) * Math.PI * 2 * 16) + 0.18 * Math.cos((y / N) * Math.PI * 2 * 8 + Math.sin((x / N) * Math.PI * 2 * 8));
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dx = (h(x + 1, y) - h(x - 1, y)) * 2.5;
        const dy = (h(x, y + 1) - h(x, y - 1)) * 2.5;
        const l = Math.hypot(dx, dy, 1);
        const o = (y * N + x) * 4;
        d[o] = (-dx / l) * 127 + 128;
        d[o + 1] = (dy / l) * 127 + 128; // キャンバスの y は下向き
        d[o + 2] = (1 / l) * 127 + 128;
        d[o + 3] = 255;
      }
    g.putImageData(id, 0, 0);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(70, 70);
    t.userData.shared = true;
    knitTex = t;
    return t;
  }

  /* ---------- 選手の生成 ---------- */
  const SKIN_TINTS = ["#f3d7c2", "#ecc8ae", "#e0b596", "#c99878", "#a9765a", "#7a5038"];
  H.createPlayer = function (o) {
    o = o || {};
    if (!H.ready) return null;
    const team = o.team || { main: "#c8102e", sub: "#ffffff", cap: "#1b1b1b", mark: "P" };
    const umpire = o.role === "umpire";
    const st = umpire
      ? { jersey: "#1d222b", pants: "#565b64", number: "#1d222b", under: "#1d222b", socks: "#111", cap: { crown: "#15181e", brim: "#15181e", button: "#15181e", markText: "" }, helmet: { color: "#15181e" }, def: {} }
      : uniformOf(team, o.home);
    st.shoes = st.shoes || "#16161a";
    const group = new T.Group();
    group.name = "player";
    // 骨
    const bones = [];
    const byName = {};
    asset.bones.forEach((b, i) => {
      const bn = new T.Bone();
      bn.name = b.name;
      const p = new T.Vector3().fromArray(b.pos);
      if (b.parent >= 0) p.sub(new T.Vector3().fromArray(asset.bones[b.parent].pos));
      bn.position.copy(p);
      if (b.parent >= 0) bones[b.parent].add(bn);
      bones.push(bn);
      byName[b.name] = bn;
      void i;
    });
    group.add(bones[0]);
    group.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(bones);
    const seed = hash(String(o.seed != null ? o.seed : (o.name || "") + (o.num || "")));
    // 画質 (view.js の V3.quality)。low では肌の光の回り込みを省き、帽子のテクスチャを小さくする
    const lowQ = !!(PB.View3D && PB.View3D.quality === "low");
    const rnd = mulberry(seed);
    // マテリアル
    const skinTint = new T.Color(o.skin3 || o.skinTint || SKIN_TINTS[Math.min(5, Math.floor((o.skinTone != null ? o.skinTone : rnd() * 3)))]);
    const beard = o.beard || (rnd() < 0.55 ? "clean" : rnd() < 0.7 ? "stubble" : "beard");
    const skinMap = asset.skins[["clean", "stubble", "beard"].indexOf(beard)] || asset.skins[0];
    // envMapIntensity: 環境マップ (scene.environment) があるときの映り込みの強さ。ないときは効かない
    const matSkin = new T.MeshStandardMaterial({ map: skinMap, color: skinTint, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 });
    skinShader(matSkin, lowQ);
    // 目: つるつるにして、環境マップ・ライトのハイライト (キャッチライト) が映るように
    const matEye = new T.MeshStandardMaterial({ map: asset.eye, roughness: 0.05, envMapIntensity: 1.5 });
    const jt = umpire ? null : jerseyTexture({ u: st, team, num: o.num, nameEn: o.nameEn, low: lowQ });
    // 布の頂点色 = build_player.py で焼いた環境光の遮蔽 (わき・股・襟の内側)。編み目の法線は低画質では省く
    const ao = (k) => !!asset.geos[k].getAttribute("color");
    const knit = lowQ ? null : knitNormal();
    const matShirt = new T.MeshStandardMaterial({ map: jt, color: umpire ? st.jersey : "#ffffff", roughness: 0.9, envMapIntensity: 0.5, vertexColors: ao("shirt"), normalMap: knit, normalScale: new T.Vector2(0.25, 0.25) });
    clothInside(matShirt);
    const matPants = new T.MeshStandardMaterial({ map: umpire ? null : pantsTexture(st, lowQ), color: umpire ? st.pants : "#ffffff", roughness: 0.9, envMapIntensity: 0.5, vertexColors: ao("pants"), normalMap: knit, normalScale: new T.Vector2(0.25, 0.25) });
    const matUnder = new T.MeshStandardMaterial({ color: st.under, roughness: 0.8, envMapIntensity: 0.5, vertexColors: ao("under") });
    const matSocks = new T.MeshStandardMaterial({ color: st.socks, roughness: 0.85, envMapIntensity: 0.5, vertexColors: ao("socks") });
    const matShoes = new T.MeshStandardMaterial({ color: st.shoes, vertexColors: true, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.8 });
    const matCap = new T.MeshStandardMaterial({ map: domeTexture("cap", st.cap.crown, st.cap, st.cap.stripes, lowQ), roughness: 0.78, envMapIntensity: 0.5 });
    const matBrim = new T.MeshStandardMaterial({ color: st.cap.brim, roughness: 0.7, envMapIntensity: 0.5 });
    const helmetP = { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.0 };
    const matHelmet = new T.MeshPhysicalMaterial(Object.assign({ map: domeTexture("helmet", st.helmet.color, umpire ? {} : st.helmet, null, lowQ) }, helmetP));
    // つば・耳当て・捕手の後ろ向きヘルメットはマークなし
    const matHelmetPlain = new T.MeshPhysicalMaterial(Object.assign({ color: st.helmet.color }, helmetP));
    const matGloveHands = new T.MeshStandardMaterial({ color: o.batGlove || "#f2f2f0", roughness: 0.55, envMapIntensity: 0.5 });
    const meshes = {};
    // 画面外の選手を描かないよう、体全体を包む球で視錐台の判定をする (SkinnedMesh の既定は骨を動かして計算 → 重いので固定の球)
    const bodySphere = new T.Sphere(new T.Vector3(0, 1.0, 0), 1.9);
    const add = (name, mat, shadow) => {
      const m = new T.SkinnedMesh(asset.geos[name], mat);
      m.name = name;
      m.castShadow = shadow !== false;
      m.receiveShadow = true;
      m.boundingSphere = bodySphere;
      m.frustumCulled = true;
      group.add(m);
      m.bind(skeleton, m.matrixWorld);
      meshes[name] = m;
      return m;
    };
    // 2004 年はほとんどの選手が靴にかかる長いパンツ (球団の longPantsRate、既定 85%)
    const longPants = o.longPants != null ? o.longPants : rnd() < (st.def && st.def.longPantsRate != null ? st.def.longPantsRate : 0.85);
    // 影は形の大きい部分だけが落とす (目・前腕のアンダー・小物は落とさない)
    add("head", matSkin);
    add("eyes", matEye, false);
    add("hands", matSkin);
    add("shirt", matShirt);
    add("under", matUnder, false);
    add("pants", matPants).visible = !longPants;
    add("pantsL", matPants).visible = longPants;
    add("socks", matSocks, !longPants).visible = !longPants; // 長いパンツの下のストッキングは描かない
    add("shoes", matShoes);
    add("cap", matCap);
    add("helmet", matHelmet);
    // 顔の個性 (モーフ)
    const head = meshes.head;
    const names = asset.geos.head.userData.morphNames || [];
    const inf = head.morphTargetInfluences;
    // 顔の個性: 各ターゲットを少しずつ混ぜる (大きくすると不自然になる)
    const RANGE = { fat: 0.18, round: 0.25, wide: 0.22, long: 0.3, oval: 0.35, square: 0.4, tri: 0.25, jaw: 0.3, epic: 0.35 };
    names.forEach((nm, i) => {
      const r = RANGE[nm] != null ? RANGE[nm] : 0.32;
      let v = (rnd() * 2 - 1) * r;
      if (nm === "caucasian" || nm === "african") v = 0;
      if (nm === "epic" || nm === "square") v = Math.abs(v);
      inf[i] = v;
    });
    if (o.race) {
      const ci = names.indexOf("caucasian");
      const ai = names.indexOf("african");
      if (ci >= 0) inf[ci] = o.race.caucasian || 0;
      if (ai >= 0) inf[ai] = o.race.african || 0;
    }
    if (o.face) for (const k in o.face) if (names.indexOf(k) >= 0) inf[names.indexOf(k)] = o.face[k];

    /* --- 帽子のつば・マーク、ヘルメットの耳当て --- */
    const headBone = byName.head;
    const capGroup = new T.Group();
    headBone.add(capGroup);
    const hb = new T.Vector3().fromArray(asset.bones[asset.bones.findIndex((b) => b.name === "head")].pos);
    const eyeL = new T.Vector3().fromArray(asset.extra.eyeL);
    const browY = eyeL.y + 0.05 - hb.y;
    const front = eyeL.z - hb.z + 0.035;
    const SG = sharedGeos();
    const brim = new T.Mesh(SG.brim, matBrim);
    brim.position.set(0, browY + 0.012, front - 0.012);
    brim.rotation.x = 0.16;
    brim.castShadow = true;
    capGroup.add(brim);
    // マークは帽子・ヘルメットのテクスチャに描き込んである
    // 帽子のてっぺんのボタン
    const button = new T.Mesh(SG.button, new T.MeshStandardMaterial({ color: st.cap.button, roughness: 0.6, envMapIntensity: 0.5 }));
    button.scale.set(1, 0.55, 1);
    button.position.set(0, asset.extra.headTop - hb.y + 0.012, eyeL.z - hb.z - 0.075);
    capGroup.add(button);
    const flap = new T.Mesh(SG.flap, matHelmetPlain);
    capGroup.add(flap);
    const capParts = { brim, flap };
    let helmetOn = !!o.helmet;
    function setHelmet(h) {
      helmetOn = !!h;
      meshes.cap.visible = !helmetOn;
      meshes.helmet.visible = helmetOn;
      brim.position.y = browY + (helmetOn ? 0.018 : 0.012);
      brim.position.z = front - (helmetOn ? 0.0 : 0.012);
      brim.scale.set(helmetOn ? 0.9 : 1, 1, helmetOn ? 0.75 : 1);
      brim.material = helmetOn ? matHelmetPlain : matBrim;
      button.visible = !helmetOn;
      const side = player.opts.bats === "L" ? -1 : 1;
      flap.visible = helmetOn;
      flap.position.set(0.072 * side, eyeL.y - hb.y - 0.012, eyeL.z - hb.z - 0.08);
    }

    /* --- 道具 --- */
    const handStd = {};
    for (const s of ["L", "R"]) {
      const o2 = new T.Object3D();
      o2.quaternion.copy(RIG["hand_" + s.toLowerCase()]).invert();
      byName["hand_" + s.toLowerCase()].add(o2);
      handStd[s] = o2;
    }
    const gear = {};
    const leather = new T.MeshStandardMaterial({ color: team.gloveColor || "#8a4e24", roughness: 0.55, envMapIntensity: 0.5 });
    const gloveHand = o.throws === "L" ? "R" : "L";
    const kind = o.pos === "C" ? "catcher" : o.pos === "1B" ? "first" : "fielder";
    const isCatcher = o.pos === "C" && o.role === "catcher" && !!PB.Gear;
    const gearCols = isCatcher || umpire ? PB.Gear.colors(st, team) : null;
    // 捕手はひもの付いた黒いキャッチャーミット
    let glove;
    if (isCatcher) glove = PB.Gear.mitt(gearCols);
    else if (PB.Gear && !umpire) {
      const gc = o.gloveColors || PB.Gear.GLOVE_COLORS[Math.floor(rnd() * PB.Gear.GLOVE_COLORS.length)];
      glove = PB.Gear.glove(kind, gc[0], gc[1]);
    } else glove = new T.Mesh(PB.Model3D.gloveGeometry(kind), leather);
    glove.castShadow = true;
    glove.position.set(0, -0.085, 0.012);
    // グラブ・ミットは指先 (-Y) を保ったまま左右を入れ替える
    if (glove.isGroup) glove.rotation.set(0, gloveHand === "L" ? 0 : Math.PI, 0);
    else glove.rotation.set(0, 0, gloveHand === "L" ? 0 : Math.PI);
    handStd[gloveHand].add(glove);
    gear.glove = glove;
    if (umpire) glove.visible = false;
    const bat = new T.Mesh(PB.Model3D.batGeometry(), new T.MeshStandardMaterial({ color: o.batColor || "#c99a5b", roughness: 0.4, envMapIntensity: 0.6 }));
    bat.castShadow = true;
    bat.visible = false;
    gear.bat = bat;
    // 球審のマスク (黒)
    if (umpire && PB.Gear) {
      const mask = PB.Gear.mask(asset, Object.assign({}, gearCols, { metal: "#26282c", trim: "#3a3d44", pad: "#18191c" }), "classic");
      headBone.add(mask);
      gear.mask = mask;
    }

    const player = {
      group,
      bones: byName,
      skeleton,
      head: headBone,
      gear,
      meshes,
      opts: o,
      human: true,
      setHelmet,
      showBat(v) {
        bat.visible = v;
      },
      showGlove(v) {
        glove.visible = v && !umpire;
      },
      setBattingGloves(v) {
        meshes.hands.material = v ? matGloveHands : matSkin;
      },
      dispose() {
        // 付け替えで今は使っていないマテリアル (つば・ヘルメット・バッティング手袋) も含めて捨てる
        const mats = new Set([matSkin, matGloveHands, matBrim, matHelmet, matHelmetPlain, matCap, bat.material]);
        group.traverse((n) => {
          if (n.material) for (const m of Array.isArray(n.material) ? n.material : [n.material]) mats.add(m);
          if (n.geometry && !n.geometry.userData.shared && !Object.values(asset.geos).includes(n.geometry) && n.geometry !== PB.Model3D.batGeometry()) n.geometry.dispose();
        });
        for (const m of mats) {
          // 共有のテクスチャ・マテリアル (帽子・パンツ・グラブなど) は残す
          if (m.userData.shared) continue;
          if (m.map && m.map !== skinMap && m.map !== asset.eye && !m.map.userData.shared) m.map.dispose();
          m.dispose();
        }
        skeleton.dispose();
      },
    };
    void capParts;
    setHelmet(helmetOn);
    // 捕手の防具 (マスク / ホッケー型ヘルメット・プロテクター・肩当て・レガース)
    if (isCatcher) {
      const style = o.maskStyle || (rnd() < 0.3 ? "hockey" : "classic");
      const cg = PB.Gear.attach(player, asset, st, team, { style });
      gear.mask = cg.mask;
      player.catcherGear = cg;
      const baseSetHelmet = player.setHelmet;
      // 防具を着けているあいだは帽子の代わりに後ろ向きのヘルメット (ホッケー型はヘルメットごと)
      const applyCatcher = () => {
        const on = cg.on !== false;
        for (const part of cg.parts) part.visible = on;
        // 後ろ向きにかぶるヘルメットは正面のマークを見せない
        meshes.helmet.material = on ? matHelmetPlain : matHelmet;
        if (!on) return;
        meshes.cap.visible = false;
        meshes.helmet.visible = style !== "hockey";
        brim.visible = false;
        button.visible = false;
        flap.visible = false;
      };
      player.setHelmet = (h) => {
        brim.visible = true;
        baseSetHelmet(h);
        applyCatcher();
      };
      player.setCatcherGear = (on) => {
        cg.on = !!on;
        player.setHelmet(helmetOn);
      };
      applyCatcher();
    }
    return player;
  };

  // 肌: 光の回り込みを色ごとに変える (赤がいちばん深く回る = 簡易的な表面下散乱) + 耳・指の逆光の透け。
  // three.js の lights_physical_pars_fragment の拡散反射の 1 行を差し替える。見つからない版では、影の側に赤みを足すだけにする
  const LAMBERT = "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );";
  let skinChunk = null;
  function skinLightsChunk() {
    if (skinChunk !== null) return skinChunk;
    const src = (T.ShaderChunk && T.ShaderChunk.lights_physical_pars_fragment) || "";
    skinChunk =
      src.indexOf(LAMBERT) >= 0 && src.indexOf("geometryViewDir") >= 0
        ? src.replace(
            LAMBERT,
            `float pbNL = dot( geometryNormal, directLight.direction );
        vec3 pbWrap = saturate( ( vec3( pbNL ) + vec3( 0.42, 0.2, 0.14 ) ) / vec3( 1.42, 1.2, 1.14 ) );
        reflectedLight.directDiffuse += pbWrap * directLight.color * BRDF_Lambert( material.diffuseColor );
        float pbBack = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 );
        reflectedLight.directDiffuse += vPbThick * pbBack * vec3( 1.0, 0.32, 0.2 ) * 0.4 * directLight.color * BRDF_Lambert( material.diffuseColor );`
          )
        : "";
    return skinChunk;
  }
  function skinShader(m, low) {
    const chunk = low ? "" : skinLightsChunk();
    m.onBeforeCompile = (sh) => {
      if (chunk && sh.fragmentShader.indexOf("#include <lights_physical_pars_fragment>") >= 0 && sh.vertexShader.indexOf("#include <begin_vertex>") >= 0) {
        sh.vertexShader = "attribute float thick;\nvarying float vPbThick;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvPbThick = thick;");
        sh.fragmentShader = "varying float vPbThick;\n" + sh.fragmentShader.replace("#include <lights_physical_pars_fragment>", chunk);
      } else {
        sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.10, 0.035, 0.02);");
      }
    };
    m.customProgramCacheKey = () => (chunk ? "pb-skin-wrap" : "pb-skin");
  }
  // 布: 両面を描き、裏 (襟ぐり・袖口からのぞく内側) は暗くする。影は今までどおり裏面で落とす
  function clothInside(m) {
    m.side = T.DoubleSide;
    m.shadowSide = T.BackSide;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        if ( ! gl_FrontFacing ) {
          reflectedLight.directDiffuse *= 0.3;
          reflectedLight.indirectDiffuse *= 0.22;
          reflectedLight.directSpecular *= 0.1;
          reflectedLight.indirectSpecular *= 0.1;
        }`
      );
    };
    m.customProgramCacheKey = () => "pb-cloth-in";
  }
  // 全員で共有する小物の形 (つば・ボタン・耳当て)
  let SGEO = null;
  function sharedGeos() {
    if (SGEO) return SGEO;
    const brimShape = new T.Shape();
    brimShape.absellipse(0, 0, 0.088, 0.078, 0, Math.PI, false);
    const brim = new T.ExtrudeGeometry(brimShape, { depth: 0.006, bevelEnabled: false, curveSegments: 18 });
    brim.rotateX(Math.PI / 2);
    const button = new T.SphereGeometry(0.009, 10, 6);
    const flap = new T.SphereGeometry(0.05, 16, 10);
    flap.scale(0.45, 1, 1.05);
    SGEO = { brim, button, flap };
    for (const k in SGEO) SGEO[k].userData.shared = true;
    return SGEO;
  }

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

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

  PB.Human = H;
})((window.PB = window.PB || {}));
