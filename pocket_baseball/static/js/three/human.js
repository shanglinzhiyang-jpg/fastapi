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
  // 球団のユニフォームに使う画像とフォントを先に読み込む
  H.preloadTeam = function (team) {
    const def = (PB.D.teamDef && PB.D.teamDef(team.id)) || team;
    const urls = [];
    for (const side of ["home", "away"]) {
      const u = def[side] || {};
      if (u.word) urls.push(u.word);
      if (u.sleevePatch) urls.push(u.sleevePatch);
    }
    if (def.capStyle && def.capStyle.mark) urls.push(def.capStyle.mark);
    if (def.helmet && def.helmet.mark) urls.push(def.helmet.mark);
    const fonts = ["Rye", "Ultra", "Graduate", "Yellowtail"].map((f) => (document.fonts && document.fonts.load ? document.fonts.load("40px '" + f + "'").catch(() => null) : null));
    return Promise.all(urls.map((u) => H.image(u).p).concat(fonts));
  };

  /* ---------- ユニフォーム (npb.js の定義から描く) ---------- */
  function uniformOf(team, home) {
    const def = (PB.D.teamDef && PB.D.teamDef(team.id)) || team;
    const away = home === false;
    const u = Object.assign({}, (away ? def.away || def.home : def.home) || {});
    u.jersey = u.jersey || (away ? "#b9bec6" : "#f6f5f0");
    u.pants = u.pants || u.jersey;
    u.number = u.number || def.main || "#222";
    u.wordColor = u.wordColor || u.number;
    u.under = def.under || def.cap || def.main || "#222";
    u.socks = def.socks || u.under;
    u.cap = Object.assign({ crown: def.cap || def.main || "#222", brim: def.cap || def.main || "#222", button: def.cap || "#222", markText: def.mark, markColor: def.sub || "#fff" }, def.capStyle || {});
    u.helmet = Object.assign({ color: u.cap.crown, markText: def.mark, markColor: def.sub || "#fff" }, def.helmet || {});
    u.def = def;
    return u;
  }
  const FONT = (f) => "'" + (f || "Graduate") + "', 'Arial Black', sans-serif";
  function drawText(g, text, x, y, size, font, fill, outline, maxW, opts) {
    opts = opts || {};
    let s = size;
    g.font = "400 " + s + "px " + FONT(font);
    while (maxW && g.measureText(text).width > maxW && s > 8) {
      s -= 1;
      g.font = "400 " + s + "px " + FONT(font);
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    if (opts.arch) {
      // アーチ状に文字を並べる
      const chars = [...text];
      const w = g.measureText(text).width;
      const R = w * 1.25;
      let a = -w / R / 2;
      for (const ch of chars) {
        const cw = g.measureText(ch).width;
        a += cw / R / 2;
        g.save();
        g.translate(x + Math.sin(a) * R, y + R - Math.cos(a) * R);
        g.rotate(a);
        if (outline) {
          g.lineWidth = s * 0.16;
          g.strokeStyle = outline;
          g.strokeText(ch, 0, 0);
        }
        g.fillStyle = fill;
        g.fillText(ch, 0, 0);
        g.restore();
        a += cw / R / 2;
      }
      return;
    }
    if (outline) {
      g.lineWidth = s * 0.16;
      g.strokeStyle = outline;
      g.strokeText(text, x, y);
    }
    g.fillStyle = fill;
    g.fillText(text, x, y);
  }
  function drawImageFit(g, url, cx, cy, maxW, maxH, tint) {
    const e = H.image(url);
    if (!e || !e.ok) return false;
    const im = e.img;
    const k = Math.min(maxW / im.width, maxH / im.height);
    const w = im.width * k;
    const h = im.height * k;
    if (tint) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      const x = c.getContext("2d");
      x.drawImage(im, 0, 0, c.width, c.height);
      x.globalCompositeOperation = "source-in";
      x.fillStyle = tint;
      x.fillRect(0, 0, c.width, c.height);
      g.drawImage(c, cx - w / 2, cy - h / 2, w, h);
    } else g.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    return true;
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
  // テクスチャ座標: 胴体は v=0.3..1 (キャンバスの上 70%), 袖は v=0..0.28 (下)。
  // u: 0.25 = 胸の中央, 0.75 = 背中の中央, 0 / 0.5 = 右脇 / 左脇。袖は外側が x=S/4 (左袖), 3S/4 (右袖)
  function jerseyTexture(o) {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const u = o.u;
    const TY = S * 0.7; // 胴体の下端 (キャンバス y)
    const vy = (v) => (1 - v) * S;
    g.fillStyle = u.jersey;
    g.fillRect(0, 0, S, S);
    // 生地のむら
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = "rgba(0,0,0," + Math.random() * 0.025 + ")";
      g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    // ベスト風: 袖をアンダーシャツの色に
    if (u.vest) {
      g.fillStyle = u.vest;
      g.fillRect(0, TY + 6, S, S - TY);
    }
    // ピンストライプ (袖は腕に沿う向き)
    if (u.pinstripe) {
      g.strokeStyle = u.pinstripe;
      g.lineWidth = 1.5;
      g.globalAlpha = 0.9;
      for (let x = 2; x < S; x += S / 44) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, u.vest ? TY : S);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // 脇のライン
    if (u.sideStripes) {
      u.sideStripes.forEach((col, i) => {
        g.fillStyle = col;
        for (const x of [0, S / 2, S]) g.fillRect(x - 7 + i * 7, 0, 6, S);
      });
    }
    // 襟ぐりの点 (前立ての上端を決める)。u 順に並べて、ギザギザをならす
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
    const front = col.length ? col.reduce((b, p) => (Math.abs(p[0] - 0.25) < Math.abs(b[0] - 0.25) ? p : b), col[0]) : [0.25, 0.9];
    const frontY = vy(front[1]);
    const trimCols = u.piping || (u.vneck ? u.vneck : u.sleeveTrim ? [u.sleeveTrim[0]] : null);
    const fx = S * 0.25;
    if (u.vneck) {
      // V ネック
      u.vneck.forEach((cc, i) => {
        g.strokeStyle = cc;
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(fx - 34 - i * 7, frontY + 2);
        g.lineTo(fx, frontY + 70 + i * 6);
        g.lineTo(fx + 34 + i * 7, frontY + 2);
        g.stroke();
      });
    } else {
      // 前立て (ボタンとパイピング)
      if (u.piping) {
        u.piping.forEach((cc, i) => {
          g.strokeStyle = cc;
          g.lineWidth = 3;
          for (const sx of [-1, 1]) {
            g.beginPath();
            g.moveTo(fx + sx * (9 + i * 4), frontY + 4);
            g.lineTo(fx + sx * (9 + i * 4), TY);
            g.stroke();
          }
        });
      } else {
        g.strokeStyle = "rgba(0,0,0,0.12)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(fx + 7, frontY);
        g.lineTo(fx + 7, TY);
        g.stroke();
      }
      g.fillStyle = "rgba(250,250,245,0.95)";
      for (let y = frontY + 26; y < TY - 10; y += 38) {
        g.beginPath();
        g.arc(fx, y, 3.2, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(0,0,0,0.25)";
        g.lineWidth = 0.8;
        g.stroke();
      }
    }
    // 胸マーク
    const chestY = frontY + 78;
    if (u.wordSmall) {
      // 左胸の小さなマーク (選手の左胸 = 画面では右)
      const cx = fx + S * 0.085;
      if (!drawImageFit(g, u.word, cx, chestY + 8, S * 0.13, S * 0.14, u.wordTint)) drawText(g, o.team.mark || "", cx, chestY, 50, u.wordFont, u.wordColor, u.wordOutline);
    } else if (u.word) {
      if (!drawImageFit(g, u.word, fx, chestY, S * 0.27, S * 0.13, u.wordTint)) drawText(g, o.team.en || "", fx, chestY, 50, u.wordFont, u.wordColor, u.wordOutline, S * 0.27);
    } else if (u.wordText) {
      const script = u.wordFont === "Yellowtail";
      g.save();
      if (script) {
        g.translate(fx, chestY);
        g.rotate(-0.1);
        drawText(g, u.wordText, 0, 0, 64, u.wordFont, u.wordColor, u.wordOutline, S * 0.27);
      } else drawText(g, u.wordText, fx, chestY, 44, u.wordFont, u.wordColor, u.wordOutline, S * 0.26, { arch: u.arch });
      g.restore();
    }
    // 胸番号
    const num = o.num != null ? String(o.num) : "";
    if (u.frontNumber !== false && num) {
      const side = u.frontNumberSide === "left" ? -1 : 1;
      const nx = fx + side * S * (u.wordSmall ? 0.085 : 0.075);
      const ny = u.wordSmall ? chestY + (side < 0 ? 4 : 58) : chestY + 52;
      drawText(g, num, nx, ny, 38, u.numberFont, u.number, u.numberOutline);
    }
    // 背中
    const bx = S * 0.75;
    if (u.backName !== false && o.nameEn) drawText(g, o.nameEn, bx, vy(0.93) + 4, 30, u.numberFont, u.number, u.numberOutline, S * 0.3);
    drawText(g, num, bx, vy(0.72), 140, u.numberFont, u.number, u.numberOutline, S * 0.36);
    // 袖
    if (u.sleeveTrim) {
      u.sleeveTrim.forEach((cc, i) => {
        g.fillStyle = cc;
        g.fillRect(0, S - 22 + i * 6, S, 4);
      });
    }
    if (u.stars) {
      star(g, S * 0.25, TY + 30, 16, u.stars);
      star(g, S * 0.75, TY + 30, 16, u.stars);
    }
    if (u.sleeveText) {
      g.save();
      g.translate(S * 0.25, TY + 70);
      g.rotate(Math.PI / 2);
      drawText(g, u.sleeveText, 0, 0, 30, u.wordFont, u.wordColor, u.wordOutline, 120);
      g.restore();
    }
    if (u.sleevePatch) drawImageFit(g, u.sleevePatch, S * 0.25, TY + 52, 64, 64);
    collarBand(g, S, u.jersey, trimCols);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  // 襟の帯: build_player.py が襟ぐりに足した折り返しの帯 (表 → 縁 → 裏)。
  // テクスチャでは裾の下 (パンツに隠れる所) の横長の行に、縁からの距離 (mm) ごとの横じまとして描く
  function collarBand(g, S, base, trimCols) {
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
    if (trimCols && trimCols.length) {
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
  // パンツ: 左脚 u=0..0.5, 右脚 0.5..1。脚ごとに 正面 = 1/8, 外側 = 1/4 (左脚) / 1/2・1 (右脚の継ぎ目)
  function pantsTexture(u) {
    const key = [u.pants, u.pantsPinstripe, (u.pantsPiping || []).join(), u.pantsText].join("|");
    if (pantsCache[key]) return pantsCache[key];
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    g.fillStyle = u.pants;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = "rgba(0,0,0," + Math.random() * 0.03 + ")";
      g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    if (u.pantsPinstripe) {
      g.strokeStyle = u.pantsPinstripe;
      g.lineWidth = 1.1;
      for (let x = 1; x < S; x += S / 36) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
    }
    if (u.pantsPiping) {
      u.pantsPiping.forEach((cc, i) => {
        g.fillStyle = cc;
        for (const x of [S * 0.25, S * 0.5, S]) {
          g.fillRect(x - 3 - i * 4, 0, 3, S);
          g.fillRect(x + 1 + i * 4, 0, 3, S);
        }
      });
    }
    if (u.pantsText) {
      g.save();
      g.translate(S * 0.19, S * 0.32);
      g.rotate(Math.PI / 2);
      drawText(g, u.pantsText, 0, 0, 16, "Graduate", u.number, null, S * 0.5);
      g.restore();
    }
    // ベルト
    g.fillStyle = "#141414";
    g.fillRect(0, 0, S, S * 0.045);
    g.fillStyle = u.pants;
    for (let x = 6; x < S; x += S / 10) g.fillRect(x, 0, 4, S * 0.05);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.userData.shared = true;
    pantsCache[key] = t;
    return t;
  }
  // 帽子・ヘルメットのマーク (正方形のキャンバス)
  function markCanvas(m) {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    if (m.mark && drawImageFit(g, m.mark, S / 2, S / 2, S * 0.92, S * 0.92)) return { c, k: 1 };
    const txt = m.markText || "";
    if (!txt) return null;
    drawText(g, txt, S / 2, S / 2 + 8, txt.length > 1 ? 190 : 230, m.markFont || "Graduate", m.markColor || "#fff", m.markOutline || null, S * 0.98);
    // 文字は四角の中で小さく見えるので、ひとまわり大きく貼る
    return { c, k: 1.25 };
  }
  // 帽子のクラウン・ヘルメットの殻: u = 頭のまわり (0.5 が正面), v = 縁 0 → てっぺん 1 (build_player.py の dome_uv)。
  // マークは正面のパネルに描き込む (浮いた板にしないので、浅い帽子でも形からはみ出さない)。球団ごとに共有する
  const domeCache = {};
  function domeTexture(kind, base, m, stripes, low) {
    const L = asset.extra[kind === "helmet" ? "helmetLogo" : "capLogo"];
    // 画質 low では半分の解像度
    const W = low ? 512 : 1024;
    const Hc = W / 4;
    const key = [kind, W, base, stripes || "", m.mark || "", m.markText || "", m.markColor || "", m.markFont || "", m.markOutline || ""].join("|");
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
      // 6 枚はぎの縫い目 (正面の中央にも 1 本)
      g.strokeStyle = "rgba(0,0,0,0.28)";
      g.lineWidth = W / 512;
      for (let k = 0; k < 6; k++) {
        const x = ((0.5 + k / 6) % 1) * W;
        g.beginPath();
        g.moveTo(x, vy(0.97));
        g.lineTo(x, Hc);
        g.stroke();
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
    const jt = umpire ? null : jerseyTexture({ u: st, team, num: o.num, nameEn: o.nameEn });
    // 布の頂点色 = build_player.py で焼いた環境光の遮蔽 (わき・股・襟の内側)
    const ao = (k) => !!asset.geos[k].getAttribute("color");
    const matShirt = new T.MeshStandardMaterial({ map: jt, color: umpire ? st.jersey : "#ffffff", roughness: 0.86, envMapIntensity: 0.5, vertexColors: ao("shirt") });
    clothInside(matShirt);
    const matPants = new T.MeshStandardMaterial({ map: umpire ? null : pantsTexture(st), color: umpire ? st.pants : "#ffffff", roughness: 0.88, envMapIntensity: 0.5, vertexColors: ao("pants") });
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
    const longPants = o.longPants != null ? o.longPants : rnd() < 0.4;
    // 影は形の大きい部分だけが落とす (目・前腕のアンダー・小物は落とさない)
    add("head", matSkin);
    add("eyes", matEye, false);
    add("hands", matSkin);
    add("shirt", matShirt);
    add("under", matUnder, false);
    add("pants", matPants).visible = !longPants;
    add("pantsL", matPants).visible = longPants;
    add("socks", matSocks, !longPants);
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
