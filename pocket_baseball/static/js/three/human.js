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

  /* ---------- ユニフォームのテクスチャ ---------- */
  const fontScript = "'Yellowtail', 'Brush Script MT', cursive";
  const fontBlock = "'Graduate', 'Alfa Slab One', 'Arial Black', sans-serif";
  function jerseyTexture(o) {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const st = o.style;
    g.fillStyle = st.jersey;
    g.fillRect(0, 0, S, S);
    // 生地のむら
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = "rgba(0,0,0," + Math.random() * 0.025 + ")";
      g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    // 胴体は v=0.3..1 (キャンバスの上 70%)、袖は v=0..0.28 (下)
    const torsoH = S * 0.7;
    if (st.pinstripe) {
      g.strokeStyle = st.pinstripe;
      g.lineWidth = 1.6;
      for (let x = 0; x < S; x += S / 46) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
    }
    // 前立て (ボタンの線) — 正面中央 u=0.25
    const fx = S * 0.25;
    g.strokeStyle = st.trim;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(fx + 6, 0);
    g.lineTo(fx + 6, torsoH);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.85)";
    for (let y = 30; y < torsoH - 10; y += 40) {
      g.beginPath();
      g.arc(fx + 2, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
    // 襟の縁取り
    g.fillStyle = st.trim;
    g.fillRect(0, 0, S, 7);
    // 胸のロゴ
    const chest = st.chest || o.team.en || "";
    g.save();
    g.translate(fx, torsoH * 0.36);
    g.rotate(-0.08);
    const script = st.script !== false;
    let size = script ? 74 : 54;
    g.font = (script ? "400 " : "900 ") + size + "px " + (script ? fontScript : fontBlock);
    while (g.measureText(chest).width > S * 0.36 && size > 20) {
      size -= 2;
      g.font = (script ? "400 " : "900 ") + size + "px " + (script ? fontScript : fontBlock);
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = 8;
    g.strokeStyle = st.letterOutline || st.trim;
    g.strokeText(chest, 0, 0);
    g.fillStyle = st.letter;
    g.fillText(chest, 0, 0);
    g.restore();
    // 胸番号 (左胸の下)
    const num = o.num != null ? String(o.num) : "";
    g.font = "900 46px " + fontBlock;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 6;
    g.strokeStyle = st.letterOutline || st.trim;
    g.strokeText(num, fx + S * 0.07, torsoH * 0.58);
    g.fillStyle = st.letter;
    g.fillText(num, fx + S * 0.07, torsoH * 0.58);
    // 背中: 名前と大きな番号 — u=0.75
    const bx = S * 0.75;
    if (o.nameEn) {
      let ns = 30;
      g.font = "900 " + ns + "px " + fontBlock;
      while (g.measureText(o.nameEn).width > S * 0.3 && ns > 12) {
        ns -= 1;
        g.font = "900 " + ns + "px " + fontBlock;
      }
      g.lineWidth = 4;
      g.strokeText(o.nameEn, bx, torsoH * 0.2);
      g.fillText(o.nameEn, bx, torsoH * 0.2);
    }
    g.font = "900 140px " + fontBlock;
    g.lineWidth = 10;
    g.strokeText(num, bx, torsoH * 0.46);
    g.fillText(num, bx, torsoH * 0.46);
    // 袖のライン
    g.fillStyle = st.trim;
    g.fillRect(0, S * (1 - 0.035), S, S * 0.02);
    g.fillRect(0, S * (1 - 0.06), S, S * 0.008);
    // 袖のワッペン (球団マーク)
    if (o.team.mark) {
      g.font = "900 34px " + fontBlock;
      g.fillStyle = st.letter;
      g.fillText(o.team.mark, S * 0.37, S * 0.82);
      g.fillText(o.team.mark, S * 0.62, S * 0.82);
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const pantsCache = {};
  function pantsTexture(st) {
    const key = [st.pants, st.pinstripe, st.trim, st.piping].join("|");
    if (pantsCache[key]) return pantsCache[key];
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    g.fillStyle = st.pants;
    g.fillRect(0, 0, S, S);
    if (st.pinstripe) {
      g.strokeStyle = st.pinstripe;
      g.lineWidth = 1.2;
      for (let x = 0; x < S; x += S / 40) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
    }
    if (st.piping) {
      g.fillStyle = st.piping;
      // 外側の縫い目 (左脚 u=0.25, 右脚 u=0.5+0 の端)
      g.fillRect(S * 0.25 - 3, 0, 6, S);
      g.fillRect(0, 0, 3, S);
      g.fillRect(S - 3, 0, 3, S);
    }
    // ベルト
    g.fillStyle = "#151515";
    g.fillRect(0, 0, S, S * 0.045);
    // ベルト通し
    g.fillStyle = st.pants;
    for (let x = 6; x < S; x += S / 10) g.fillRect(x, 0, 4, S * 0.05);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    pantsCache[key] = t;
    return t;
  }

  /* ---------- チームの見た目 (初期値) ---------- */
  function styleOf(team, home) {
    const s = Object.assign({}, team.uniform || {});
    const away = home === false;
    const jersey = away ? s.awayJersey || "#b9bec6" : s.jersey || "#f6f5f0";
    return {
      jersey,
      pants: away ? s.awayPants || "#c7ccd3" : s.pants || "#f6f5f0",
      letter: away ? s.awayLetter || team.main : s.letter || team.main,
      letterOutline: away ? s.awayOutline || s.outline || team.sub || "#fff" : s.outline || team.sub || "#fff",
      trim: s.trim || team.main,
      piping: s.piping === false ? null : s.piping || team.main,
      pinstripe: !away && s.pinstripe ? s.pinstripe : null,
      chest: away ? s.awayChest || s.chest : s.chest,
      script: s.script,
      under: s.under || team.cap || team.main,
      socks: s.socks || s.under || team.cap || team.main,
      cap: s.cap || team.cap || team.main,
      capMark: s.capMark || team.sub || "#fff",
      shoes: s.shoes || "#16161a",
      longPants: s.longPants,
    };
  }

  /* ---------- 選手の生成 ---------- */
  const SKIN_TINTS = ["#f3d7c2", "#ecc8ae", "#e0b596", "#c99878", "#a9765a", "#7a5038"];
  H.createPlayer = function (o) {
    o = o || {};
    if (!H.ready) return null;
    const team = o.team || { main: "#c8102e", sub: "#ffffff", cap: "#1b1b1b", mark: "P" };
    const umpire = o.role === "umpire";
    const st = umpire ? { jersey: "#1d222b", pants: "#565b64", letter: "#1d222b", trim: "#2b313c", under: "#1d222b", socks: "#111", cap: "#15181e", capMark: "#15181e", shoes: "#0d0d0d" } : styleOf(team, o.home);
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
    const rnd = mulberry(seed);
    // マテリアル
    const skinTint = new T.Color(o.skin3 || o.skinTint || SKIN_TINTS[Math.min(5, Math.floor((o.skinTone != null ? o.skinTone : rnd() * 3)))]);
    const beard = o.beard || (rnd() < 0.55 ? "clean" : rnd() < 0.7 ? "stubble" : "beard");
    const skinMap = asset.skins[["clean", "stubble", "beard"].indexOf(beard)] || asset.skins[0];
    const matSkin = new T.MeshStandardMaterial({ map: skinMap, color: skinTint, roughness: 0.62, metalness: 0 });
    softSkin(matSkin);
    const matEye = new T.MeshStandardMaterial({ map: asset.eye, roughness: 0.12 });
    const jt = umpire ? null : jerseyTexture({ style: st, team, num: o.num, nameEn: o.nameEn });
    const matShirt = new T.MeshStandardMaterial({ map: jt, color: umpire ? st.jersey : "#ffffff", roughness: 0.86 });
    const matPants = new T.MeshStandardMaterial({ map: umpire ? null : pantsTexture(st), color: umpire ? st.pants : "#ffffff", roughness: 0.88 });
    const matUnder = new T.MeshStandardMaterial({ color: st.under, roughness: 0.8 });
    const matSocks = new T.MeshStandardMaterial({ color: st.socks, roughness: 0.85 });
    const matShoes = new T.MeshStandardMaterial({ color: st.shoes, vertexColors: true, roughness: 0.35, metalness: 0.05 });
    const matCap = new T.MeshStandardMaterial({ color: st.cap, roughness: 0.75 });
    const matHelmet = new T.MeshPhysicalMaterial({ color: st.cap, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
    const matGloveHands = new T.MeshStandardMaterial({ color: o.batGlove || "#f2f2f0", roughness: 0.55 });
    const meshes = {};
    const add = (name, mat) => {
      const m = new T.SkinnedMesh(asset.geos[name], mat);
      m.name = name;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      group.add(m);
      m.bind(skeleton, m.matrixWorld);
      meshes[name] = m;
      return m;
    };
    add("head", matSkin);
    add("eyes", matEye);
    add("hands", matSkin);
    add("shirt", matShirt);
    add("under", matUnder);
    const longPants = o.longPants != null ? o.longPants : st.longPants != null ? st.longPants : rnd() < 0.35;
    add("pants", matPants).visible = !longPants;
    add("pantsL", matPants).visible = longPants;
    add("socks", matSocks);
    add("shoes", matShoes);
    add("cap", matCap);
    add("helmet", matHelmet);
    // 顔の個性 (モーフ)
    const head = meshes.head;
    const names = asset.geos.head.userData.morphNames || [];
    const inf = head.morphTargetInfluences;
    names.forEach((nm, i) => {
      let v = (rnd() * 2 - 1) * 0.55;
      if (nm === "caucasian" || nm === "african") v = 0;
      if (nm === "epic") v = rnd() * 0.5;
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
    const brimShape = new T.Shape();
    brimShape.absellipse(0, 0, 0.088, 0.078, 0, Math.PI, false);
    const brim = new T.Mesh(new T.ExtrudeGeometry(brimShape, { depth: 0.006, bevelEnabled: false, curveSegments: 18 }), matCap);
    brim.geometry.rotateX(Math.PI / 2);
    brim.position.set(0, browY + 0.012, front - 0.012);
    brim.rotation.x = 0.16;
    brim.castShadow = true;
    capGroup.add(brim);
    const logoTex = PB.Model3D.capLogoTexture(team.mark || "", st.capMark, st.cap);
    const logo = new T.Mesh(new T.PlaneGeometry(0.05, 0.05), new T.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 }));
    logo.position.set(0, browY + 0.05, front - 0.004);
    logo.rotation.x = -0.32;
    capGroup.add(logo);
    const flapG = new T.SphereGeometry(0.05, 16, 10);
    flapG.scale(0.45, 1, 1.05);
    const flap = new T.Mesh(flapG, matHelmet);
    flap.castShadow = true;
    capGroup.add(flap);
    if (umpire) logo.visible = false;
    const capParts = { brim, logo, flap };
    let helmetOn = !!o.helmet;
    function setHelmet(h) {
      helmetOn = !!h;
      meshes.cap.visible = !helmetOn;
      meshes.helmet.visible = helmetOn;
      brim.position.y = browY + (helmetOn ? 0.018 : 0.012);
      brim.position.z = front - (helmetOn ? 0.0 : 0.012);
      brim.scale.set(helmetOn ? 0.9 : 1, 1, helmetOn ? 0.75 : 1);
      brim.material = helmetOn ? matHelmet : matCap;
      logo.position.set(0, browY + (helmetOn ? 0.06 : 0.05), front + (helmetOn ? 0.012 : -0.004));
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
    const leather = new T.MeshStandardMaterial({ color: team.gloveColor || "#8a4e24", roughness: 0.55 });
    const gloveHand = o.throws === "L" ? "R" : "L";
    const kind = o.pos === "C" ? "catcher" : o.pos === "1B" ? "first" : "fielder";
    const glove = new T.Mesh(PB.Model3D.gloveGeometry(kind), leather);
    glove.castShadow = true;
    glove.position.set(0, -0.085, 0.012);
    glove.rotation.set(0, 0, gloveHand === "L" ? 0 : Math.PI);
    handStd[gloveHand].add(glove);
    gear.glove = glove;
    if (umpire) glove.visible = false;
    const bat = new T.Mesh(PB.Model3D.batGeometry(), new T.MeshStandardMaterial({ color: o.batColor || "#c99a5b", roughness: 0.4 }));
    bat.castShadow = true;
    bat.visible = false;
    gear.bat = bat;
    // 捕手のマスク・プロテクター
    if (o.pos === "C" && o.role === "catcher") {
      const pad = new T.Mesh(new T.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), new T.MeshStandardMaterial({ color: st.cap, roughness: 0.6 }));
      pad.scale.set(1.05, 1.5, 0.55);
      pad.rotation.x = Math.PI / 2;
      pad.position.set(0, 0.08, 0.13);
      byName.spine_03.add(pad);
      const mask = new T.Mesh(new T.TorusGeometry(0.075, 0.008, 6, 18), new T.MeshStandardMaterial({ color: "#222", roughness: 0.4, metalness: 0.5 }));
      mask.position.set(0, eyeL.y - hb.y - 0.01, eyeL.z - hb.z + 0.05);
      headBone.add(mask);
      gear.mask = mask;
    }
    if (umpire) {
      const mask = new T.Mesh(new T.TorusGeometry(0.073, 0.008, 6, 18), new T.MeshStandardMaterial({ color: "#111", roughness: 0.4, metalness: 0.5 }));
      mask.position.set(0, eyeL.y - hb.y - 0.012, eyeL.z - hb.z + 0.05);
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
        group.traverse((n) => {
          if (n.material) {
            const ms = Array.isArray(n.material) ? n.material : [n.material];
            for (const m of ms) {
              if (m.map && m.map !== skinMap && m.map !== asset.eye && !Object.values(pantsCache).includes(m.map)) m.map.dispose();
              m.dispose();
            }
          }
          if (n.geometry && !Object.values(asset.geos).includes(n.geometry) && n.geometry !== PB.Model3D.batGeometry()) n.geometry.dispose();
        });
        skeleton.dispose();
      },
    };
    void capParts;
    setHelmet(helmetOn);
    return player;
  };

  // 肌: 影の境目をやわらかく赤みがかった色に (簡易的な表面下散乱)
  function softSkin(m) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.10, 0.035, 0.02);`
      );
    };
    m.customProgramCacheKey = () => "pb-skin";
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

  class HRig {
    constructor(player) {
      this.player = player;
      this.b = player.bones;
      this.rest = {};
      for (const k in this.b) this.rest[k] = this.b[k].position.clone();
      this.cur = A.basePose();
      this.bat = player.gear.bat;
      this.grip = { L: 0.3, R: 0.3 };
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
      _m1.copy(frame(r, a));
      _m2.copy(frame(d, n));
      _m2.multiply(_m1.transpose());
      _q1.setFromRotationMatrix(_m2);
      bone.parent.getWorldQuaternion(_q2);
      bone.quaternion.copy(_q2.invert().multiply(_q1));
      bone.updateMatrixWorld(true);
    }
    limb(a, b, c, R, tgt, pole) {
      a.updateMatrixWorld(true);
      const pA = new T.Vector3().setFromMatrixPosition(a.matrixWorld);
      const dv = tgt.clone().sub(pA);
      let d = dv.length();
      const L1 = R.L1;
      const L2 = R.L2;
      d = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, d));
      const u = dv.normalize();
      const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const pv = pole.clone().sub(pA);
      pv.addScaledVector(u, -pv.dot(u));
      if (pv.lengthSq() < 1e-8) pv.set(0, 0, 1);
      pv.normalize();
      const E = pA.clone().addScaledVector(u, L1 * cosA).addScaledVector(pv, L1 * sinA);
      const W = pA.clone().addScaledVector(u, d);
      // 曲げの平面の法線
      const n = E.clone().sub(pA).cross(W.clone().sub(E));
      if (n.lengthSq() < 1e-8) n.copy(u).cross(pv).negate();
      n.normalize();
      // 休止姿勢の曲げ軸と符号をそろえる (ワールドに写した休止軸と同じ向き)
      this.aimFrame(a, R.ru, R.au, E.clone().sub(pA), n);
      this.aimFrame(b, R.rf, R.af, W.clone().sub(E), n);
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
      const tw = new T.Vector3();
      const pw = new T.Vector3();
      this.limb(b.upperarm_l, b.lowerarm_l, b.hand_l, RIG.arm_l, this.toWorld(armL, tw).clone(), this.toWorld(p.armL.p, pw).clone());
      this.orientHand(b.hand_l, "l", p.armL.h);
      this.limb(b.upperarm_r, b.lowerarm_r, b.hand_r, RIG.arm_r, this.toWorld(armR, tw).clone(), this.toWorld(p.armR.p, pw).clone());
      this.orientHand(b.hand_r, "r", p.armR.h);
      // 足首の位置は Rig (簡易モデル) と同じ定義
      this.limb(b.thigh_l, b.calf_l, b.foot_l, RIG.leg_l, this.toWorld(p.legL.t, tw).clone(), this.toWorld(p.legL.p, pw).clone());
      this.orientFoot(b.foot_l, p.legL.f);
      this.limb(b.thigh_r, b.calf_r, b.foot_r, RIG.leg_r, this.toWorld(p.legR.t, tw).clone(), this.toWorld(p.legR.p, pw).clone());
      this.orientFoot(b.foot_r, p.legR.f);
      // 指
      const gl = this.player.gear.glove && this.player.gear.glove.visible;
      const gh = this.player.opts.throws === "L" ? "r" : "l";
      for (const s of ["l", "r"]) {
        let k = this.grip[s.toUpperCase()];
        if (p.bat.on) k = 1;
        else if (gl && s === gh) k = 0.5;
        this.fingers(s, k);
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
    drive(target, dt, rate) {
      const k = rate == null ? 1 : 1 - Math.exp(-rate * dt);
      this.apply(A.lerpPose(this.cur, target, k, this._tmp || (this._tmp = A.basePose())));
      this.cur = A.copyPose(this._tmp);
    }
  }
  H.Rig = HRig;
  void _v3;

  PB.Human = H;
})((window.PB = window.PB || {}));
