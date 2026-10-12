/* 熱闘！ポケットベースボール — 選手・チーム・変化球データ */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = {};

  /* ---------- 能力ランク ---------- */
  D.RANKS = [
    { r: "S", min: 90, color: "#ff4fa3" },
    { r: "A", min: 80, color: "#ff5d5d" },
    { r: "B", min: 70, color: "#ff9a3c" },
    { r: "C", min: 60, color: "#f5c242" },
    { r: "D", min: 50, color: "#c9d94a" },
    { r: "E", min: 40, color: "#62c46a" },
    { r: "F", min: 20, color: "#4ba3e0" },
    { r: "G", min: 0, color: "#9aa3ad" },
  ];
  D.rank = function (v) {
    for (const r of D.RANKS) if (v >= r.min) return r;
    return D.RANKS[D.RANKS.length - 1];
  };

  D.POS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
  D.POS_JP = { P: "投", C: "捕", "1B": "一", "2B": "二", "3B": "三", SS: "遊", LF: "左", CF: "中", RF: "右", DH: "指" };
  D.POS_FULL = { P: "投手", C: "捕手", "1B": "一塁手", "2B": "二塁手", "3B": "三塁手", SS: "遊撃手", LF: "左翼手", CF: "中堅手", RF: "右翼手", DH: "指名打者" };
  D.FIELD_POS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

  /* ---------- 変化球 ----------
   * bx: グラブ側(右投手なら捕手から見て右)への変化量[m]
   * bz: 縦の変化量[m] (負=落ちる)
   * pow: 変化の「遅さ」(大きいほど手元で曲がる)
   * spd: ストレートに対する球速比
   * arrow: 右投手から見た変化方向 (捕手視点の画面方向) */
  D.PITCHES = {
    FB: { name: "ストレート", short: "ストレート", spd: () => 1.0, bx: () => 0, bz: () => 0, pow: 2, g: 0.72 },
    TS: { name: "ツーシーム", short: "ツーシーム", spd: () => 0.97, bx: (l) => -(0.03 + 0.012 * l), bz: (l) => -(0.02 + 0.01 * l), pow: 2.6, g: 0.85 },
    SL: { name: "スライダー", short: "スライダー", spd: () => 0.88, bx: (l) => 0.05 + 0.034 * l, bz: (l) => -(0.03 + 0.006 * l), pow: 2.3, g: 0.95 },
    HS: { name: "Hスライダー", short: "Hスライダー", spd: () => 0.9, bx: (l) => 0.08 + 0.04 * l, bz: () => -0.02, pow: 2.5, g: 0.92 },
    CT: { name: "カットボール", short: "カット", spd: () => 0.95, bx: (l) => 0.025 + 0.018 * l, bz: () => -0.01, pow: 2.8, g: 0.85 },
    CB: { name: "カーブ", short: "カーブ", spd: () => 0.76, bx: (l) => 0.04 + 0.022 * l, bz: (l) => -(0.08 + 0.045 * l), pow: 1.7, g: 1.0 },
    SC: { name: "スローカーブ", short: "Sカーブ", spd: () => 0.66, bx: (l) => 0.03 + 0.018 * l, bz: (l) => -(0.1 + 0.05 * l), pow: 1.5, g: 1.0 },
    FK: { name: "フォーク", short: "フォーク", spd: () => 0.86, bx: () => 0, bz: (l) => -(0.09 + 0.05 * l), pow: 2.7, g: 1.0 },
    SF: { name: "SFF", short: "SFF", spd: () => 0.92, bx: () => -0.02, bz: (l) => -(0.06 + 0.038 * l), pow: 2.9, g: 0.95 },
    CH: { name: "チェンジアップ", short: "チェンジ", spd: (l) => 0.84 - 0.012 * l, bx: () => -0.03, bz: (l) => -(0.05 + 0.03 * l), pow: 2.0, g: 1.0 },
    SK: { name: "シンカー", short: "シンカー", spd: () => 0.84, bx: (l) => -(0.04 + 0.026 * l), bz: (l) => -(0.06 + 0.035 * l), pow: 2.3, g: 1.0 },
    SH: { name: "シュート", short: "シュート", spd: () => 0.93, bx: (l) => -(0.05 + 0.03 * l), bz: () => -0.03, pow: 2.2, g: 0.9 },
    VS: { name: "Vスライダー", short: "Vスラ", spd: () => 0.86, bx: (l) => 0.05 + 0.028 * l, bz: (l) => -(0.06 + 0.035 * l), pow: 2.4, g: 0.95 },
    KN: { name: "ナックル", short: "ナックル", spd: () => 0.7, bx: () => 0, bz: (l) => -(0.04 + 0.02 * l), pow: 2, g: 1.0, knuckle: true },
  };
  // 方向グリフ (右投手・捕手視点)
  D.pitchArrow = function (type, throws) {
    const p = D.PITCHES[type];
    const lv = 4;
    let x = p.bx(lv);
    const z = p.bz(lv) + (type === "FB" ? 0.05 : 0);
    if (throws === "L") x = -x;
    if (p.knuckle) return "〜";
    if (Math.abs(x) < 0.02 && Math.abs(z) < 0.04) return "●";
    const ang = Math.atan2(-z, x); // 画面座標(下が正)
    const dirs = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
    const idx = Math.round(ang / (Math.PI / 4));
    return dirs[(idx + 8) % 8];
  };

  /* ---------- 特殊能力 ---------- */
  D.SKILLS = {
    // 野手
    chance: { name: "チャンス◯", type: "bat", good: true, desc: "得点圏でミートカーソルが大きくなる" },
    chanceX: { name: "チャンス✕", type: "bat", good: false, desc: "得点圏でミートカーソルが小さくなる" },
    vsLeft: { name: "対左投手◯", type: "bat", good: true, desc: "左投手に強い" },
    powerHitter: { name: "パワーヒッター", type: "bat", good: true, desc: "打球が上がりやすく飛距離が伸びる" },
    avgHitter: { name: "アベレージヒッター", type: "bat", good: true, desc: "芯が広く、ヒットになりやすい" },
    spray: { name: "広角打法", type: "bat", good: true, desc: "逆方向にも強い打球が打てる" },
    steal: { name: "盗塁◯", type: "bat", good: true, desc: "盗塁のスタートが良い" },
    baserun: { name: "走塁◯", type: "bat", good: true, desc: "次の塁を積極的に狙う" },
    infieldHit: { name: "内野安打◯", type: "bat", good: true, desc: "一塁への到達が速い" },
    eye: { name: "選球眼", type: "bat", good: true, desc: "ボール球に手を出しにくい" },
    laser: { name: "レーザービーム", type: "bat", good: true, desc: "外野からの送球が速い" },
    throwAcc: { name: "送球◯", type: "bat", good: true, desc: "悪送球をしにくい" },
    clutch: { name: "サヨナラ男", type: "bat", good: true, desc: "9回以降の同点・負け場面でパワー上昇" },
    firstPitch: { name: "初球◯", type: "bat", good: true, desc: "初球に強い" },
    catcher: { name: "キャッチャー◎", type: "bat", good: true, desc: "捕手のとき投手のコントロールが上がる" },
    // 投手
    nobi: { name: "ノビ◯", type: "pit", good: true, desc: "ストレートが打ちにくい" },
    kire: { name: "キレ◯", type: "pit", good: true, desc: "変化球が手元で鋭く曲がる" },
    k: { name: "奪三振", type: "pit", good: true, desc: "2ストライクから変化と球速が増す" },
    pinch: { name: "ピンチ◯", type: "pit", good: true, desc: "得点圏で能力が上がる" },
    vsLeftP: { name: "対左打者◯", type: "pit", good: true, desc: "左打者に強い" },
    heavy: { name: "重い球", type: "pit", good: true, desc: "打球が飛びにくい" },
    quick: { name: "クイック◯", type: "pit", good: true, desc: "盗塁されにくい" },
    lateGood: { name: "尻上がり", type: "pit", good: true, desc: "終盤ほど調子が上がる" },
    low: { name: "低め◯", type: "pit", good: true, desc: "低めのコントロールが良い" },
    tough: { name: "打たれ強さ◯", type: "pit", good: true, desc: "ランナーを背負っても崩れない" },
    hold: { name: "球持ち◯", type: "pit", good: true, desc: "タイミングを取られにくい" },
  };
  D.has = (p, s) => !!(p && p.skills && p.skills.indexOf(s) >= 0);

  /* ---------- 名前 ---------- */
  D.SURNAMES = (
    "佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 斎藤 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 遠藤 青木 福田 太田 西村 藤井 金子 藤原 中野 三浦 原田 中川 松田 竹内 小野 田村 中山 和田 石田 森田 上田 原 内田 柴田 酒井 宮崎 横山 高木 安藤 宮本 大野 小島 谷口 今井 工藤 高田 増田 丸山 杉山 大塚 新井 小山 平野 藤本 河野 上野 野口 武田 千葉 岩崎 菅原 木下 久保 佐野 野村 松尾 菊地 杉本 市川 古川 大西 島田 水野 桜井 高野 渡部 吉川 山内 西田 飯田 西川 小松 北村 安田 五十嵐 川口 平田 関 服部 東 岩田 土屋 川崎 福島 本田 辻 樋口 秋山 田口 永井 山中 中西 吉村 川上 石原 大橋 松岡 馬場 浅野 荒木 大久保 野田 小沢 田辺 川村 星野 黒田 堀 尾崎 望月 永田 熊谷 内藤 松村 西山 大島 根本 早川 片山 宇野 鶴田 猪俣 霧島 雷電 剛田 鬼塚 獅子堂 鷹野 白鳥 赤星 黒岩 竜崎"
  ).split(" ");
  D.GIVEN = (
    "翔太 大輝 健太 拓也 直樹 亮 達也 誠 隼人 優斗 蓮 悠真 颯太 大和 陸 湊 樹 海斗 慎吾 剛 大地 翼 将太 勇気 一輝 和也 浩二 雄大 光 純平 圭介 智也 康介 秀樹 龍之介 虎太郎 新 晴人 蒼 涼介 豪 鉄平 弾 球児 竜也 迅 烈 銀次 力 鷹也"
  ).split(" ");

  // 背ネーム用のローマ字
  D.ROMAJI = {};
  (function () {
    const a = (
      "佐藤 SATO 鈴木 SUZUKI 高橋 TAKAHASHI 田中 TANAKA 伊藤 ITO 渡辺 WATANABE 山本 YAMAMOTO 中村 NAKAMURA 小林 KOBAYASHI 加藤 KATO 吉田 YOSHIDA 山田 YAMADA 佐々木 SASAKI 山口 YAMAGUCHI 松本 MATSUMOTO 井上 INOUE 木村 KIMURA 林 HAYASHI 斎藤 SAITO 清水 SHIMIZU 山崎 YAMAZAKI 森 MORI 池田 IKEDA 橋本 HASHIMOTO 阿部 ABE 石川 ISHIKAWA 山下 YAMASHITA 中島 NAKAJIMA 石井 ISHII 小川 OGAWA 前田 MAEDA 岡田 OKADA 長谷川 HASEGAWA 藤田 FUJITA 後藤 GOTO 近藤 KONDO 遠藤 ENDO 青木 AOKI 福田 FUKUDA 太田 OTA 西村 NISHIMURA 藤井 FUJII 金子 KANEKO 藤原 FUJIWARA 中野 NAKANO 三浦 MIURA 原田 HARADA 中川 NAKAGAWA 松田 MATSUDA 竹内 TAKEUCHI 小野 ONO 田村 TAMURA 中山 NAKAYAMA 和田 WADA 石田 ISHIDA 森田 MORITA 上田 UEDA 原 HARA 内田 UCHIDA 柴田 SHIBATA 酒井 SAKAI 宮崎 MIYAZAKI 横山 YOKOYAMA 高木 TAKAGI 安藤 ANDO 宮本 MIYAMOTO 大野 ONO 小島 KOJIMA 谷口 TANIGUCHI 今井 IMAI 工藤 KUDO 高田 TAKADA 増田 MASUDA 丸山 MARUYAMA 杉山 SUGIYAMA 大塚 OTSUKA 新井 ARAI 小山 KOYAMA 平野 HIRANO 藤本 FUJIMOTO 河野 KONO 上野 UENO 野口 NOGUCHI 武田 TAKEDA 千葉 CHIBA 岩崎 IWASAKI 菅原 SUGAWARA 木下 KINOSHITA 久保 KUBO 佐野 SANO 野村 NOMURA 松尾 MATSUO 菊地 KIKUCHI 杉本 SUGIMOTO 市川 ICHIKAWA 古川 FURUKAWA 大西 ONISHI 島田 SHIMADA 水野 MIZUNO 桜井 SAKURAI 高野 TAKANO 渡部 WATANABE 吉川 YOSHIKAWA 山内 YAMAUCHI 西田 NISHIDA 飯田 IIDA 西川 NISHIKAWA 小松 KOMATSU 北村 KITAMURA 安田 YASUDA 五十嵐 IGARASHI 川口 KAWAGUCHI 平田 HIRATA 関 SEKI 服部 HATTORI 東 AZUMA 岩田 IWATA 土屋 TSUCHIYA 川崎 KAWASAKI 福島 FUKUSHIMA 本田 HONDA 辻 TSUJI 樋口 HIGUCHI 秋山 AKIYAMA 田口 TAGUCHI 永井 NAGAI 山中 YAMANAKA 中西 NAKANISHI 吉村 YOSHIMURA 川上 KAWAKAMI 石原 ISHIHARA 大橋 OHASHI 松岡 MATSUOKA 馬場 BABA 浅野 ASANO 荒木 ARAKI 大久保 OKUBO 野田 NODA 小沢 OZAWA 田辺 TANABE 川村 KAWAMURA 星野 HOSHINO 黒田 KURODA 堀 HORI 尾崎 OZAKI 望月 MOCHIZUKI 永田 NAGATA 熊谷 KUMAGAI 内藤 NAITO 松村 MATSUMURA 西山 NISHIYAMA 大島 OSHIMA 根本 NEMOTO 早川 HAYAKAWA 片山 KATAYAMA 宇野 UNO 鶴田 TSURUTA 猪俣 INOMATA 霧島 KIRISHIMA 雷電 RAIDEN 剛田 GODA 鬼塚 ONIZUKA 獅子堂 SHISHIDO 鷹野 TAKANO 白鳥 SHIRATORI 赤星 AKAHOSHI 黒岩 KUROIWA 竜崎 RYUZAKI"
    ).split(" ");
    for (let i = 0; i + 1 < a.length; i += 2) D.ROMAJI[a[i]] = a[i + 1];
  })();
  // かな → ローマ字 (読みがある選手用)
  const KANA = { あ: "A", い: "I", う: "U", え: "E", お: "O", か: "KA", き: "KI", く: "KU", け: "KE", こ: "KO", さ: "SA", し: "SHI", す: "SU", せ: "SE", そ: "SO", た: "TA", ち: "CHI", つ: "TSU", て: "TE", と: "TO", な: "NA", に: "NI", ぬ: "NU", ね: "NE", の: "NO", は: "HA", ひ: "HI", ふ: "FU", へ: "HE", ほ: "HO", ま: "MA", み: "MI", む: "MU", め: "ME", も: "MO", や: "YA", ゆ: "YU", よ: "YO", ら: "RA", り: "RI", る: "RU", れ: "RE", ろ: "RO", わ: "WA", を: "O", ん: "N", が: "GA", ぎ: "GI", ぐ: "GU", げ: "GE", ご: "GO", ざ: "ZA", じ: "JI", ず: "ZU", ぜ: "ZE", ぞ: "ZO", だ: "DA", ぢ: "JI", づ: "ZU", で: "DE", ど: "DO", ば: "BA", び: "BI", ぶ: "BU", べ: "BE", ぼ: "BO", ぱ: "PA", ぴ: "PI", ぷ: "PU", ぺ: "PE", ぽ: "PO" };
  const YOON = { ゃ: "YA", ゅ: "YU", ょ: "YO" };
  D.kanaToRomaji = function (s) {
    s = String(s || "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const n = s[i + 1];
      if (c === "っ" && n && KANA[n]) {
        out += KANA[n][0];
        continue;
      }
      if (c === "ー") continue;
      if (n && YOON[n] && KANA[c]) {
        const base = KANA[c];
        out += (base === "SHI" ? "SH" : base === "CHI" ? "CH" : base === "JI" ? "J" : base.slice(0, -1)) + (base === "SHI" || base === "CHI" || base === "JI" ? YOON[n].slice(1) : YOON[n]);
        i++;
        continue;
      }
      out += KANA[c] || (/[A-Za-z]/.test(c) ? c.toUpperCase() : "");
    }
    return out.replace(/OU/g, "O").replace(/OO/g, "O").replace(/UU/g, "U");
  };
  D.romaji = function (p) {
    if (!p) return "";
    if (p.nameEn) return p.nameEn;
    if (D.ROMAJI[p.name]) return D.ROMAJI[p.name];
    if (p.kana) return D.kanaToRomaji(String(p.kana).split(/[ 　]/)[0]);
    if (/^[A-Za-z .'-]+$/.test(p.name || "")) return String(p.name).toUpperCase();
    return "";
  };

  /* ---------- 顔 ---------- */
  D.SKINS = ["#ffd9b8", "#f7caa0", "#eab78f", "#d9a274", "#ffe1c8"];
  D.EYES = ["round", "round", "round", "smile", "line", "big", "sharp", "glasses"];

  /* ---------- チーム ---------- */
  D.TEAMS = [
    { id: "phx", name: "東都フェニックス", short: "東都", en: "PHOENIX", mark: "P", main: "#d7263d", sub: "#ffd23f", cap: "#7d0f1f", style: "ace", seed: 1101, stadium: "東都スカイドーム" },
    { id: "oct", name: "浪速オクトパス", short: "浪速", en: "OCTOPUS", mark: "O", main: "#7b2cbf", sub: "#ff9f1c", cap: "#45127a", style: "power", seed: 2202, stadium: "浪速たこやきスタジアム" },
    { id: "bea", name: "北海スノーベアーズ", short: "北海", en: "BEARS", mark: "B", main: "#3fb6e8", sub: "#ffffff", cap: "#173a63", style: "speed", seed: 3303, stadium: "北海しろくまパーク" },
    { id: "typ", name: "博多タイフーンズ", short: "博多", en: "TYPHOONS", mark: "T", main: "#23a08f", sub: "#f2d16b", cap: "#11524a", style: "pitch", seed: 4404, stadium: "博多ベイフィールド" },
    { id: "sha", name: "尾張シャチホコズ", short: "尾張", en: "SHACHIS", mark: "S", main: "#e3a600", sub: "#1d1d1d", cap: "#1d1d1d", style: "contact", seed: 5505, stadium: "尾張きんのしゃちドーム" },
    { id: "thu", name: "みちのくサンダース", short: "陸奥", en: "THUNDERS", mark: "M", main: "#22406e", sub: "#f4d35e", cap: "#0b1a33", style: "slug", seed: 6606, stadium: "杜の都いなずま球場" },
  ];

  // 守備位置ごとの能力傾向 [meet, power, speed, arm, field, catch]
  const POS_BIAS = {
    C: [-4, 2, -14, 10, 4, 6],
    "1B": [2, 12, -10, -8, -6, 0],
    "2B": [4, -8, 8, -2, 8, 6],
    "3B": [0, 8, -4, 8, 2, 0],
    SS: [0, -6, 10, 8, 12, 6],
    LF: [2, 8, 0, -4, -6, -2],
    CF: [4, -2, 14, 4, 10, 4],
    RF: [0, 8, 2, 12, 0, 0],
    DH: [4, 14, -10, -10, -16, -10],
  };
  const STYLE_BIAS = {
    ace: { bat: [0, 0, 0, 0, 2, 0], pit: 4, star: "pit" },
    power: { bat: [-3, 9, -5, 0, -4, -2], pit: -4, star: "bat" },
    speed: { bat: [3, -6, 10, 2, 6, 4], pit: 0, star: "spd" },
    pitch: { bat: [-2, -2, 0, 0, 2, 2], pit: 7, star: "pit" },
    contact: { bat: [8, -2, 0, 0, 2, 2], pit: 1, star: "bat" },
    slug: { bat: [-2, 6, 4, 2, -2, -2], pit: -2, star: "bat" },
  };

  const BAT_SKILLS_POOL = ["chance", "vsLeft", "powerHitter", "avgHitter", "spray", "steal", "baserun", "infieldHit", "eye", "laser", "throwAcc", "clutch", "firstPitch"];
  const PIT_SKILLS_POOL = ["nobi", "kire", "k", "pinch", "vsLeftP", "heavy", "quick", "lateGood", "low", "tough", "hold"];

  function genFace(rng) {
    return {
      skin: rng.pick(D.SKINS),
      eyes: rng.pick(D.EYES),
      brow: rng.int(0, 2),
      hair: rng.pick(["#2b1b14", "#3a2618", "#1a1a1a", "#5a3a22", "#7a4b28"]),
      cheek: rng.next() < 0.35,
    };
  }

  function clampAb(v) {
    return Math.round(U.clamp(v, 1, 100));
  }

  function genBatter(rng, pos, tier, style) {
    const base = tier === "star" ? 74 : tier === "reg" ? 58 : 47;
    const pb = POS_BIAS[pos];
    const sb = STYLE_BIAS[style].bat;
    const ab = [];
    for (let i = 0; i < 6; i++) ab.push(clampAb(base + pb[i] + sb[i] + rng.gauss() * 9));
    const p = {
      pos,
      meet: ab[0],
      power: ab[1],
      speed: ab[2],
      arm: ab[3],
      field: ab[4],
      catch: ab[5],
      traj: U.clamp(Math.round(1.6 + (ab[1] - 40) / 22 + rng.gauss() * 0.4), 1, 4),
      throws: pos === "1B" || pos === "LF" || pos === "DH" ? (rng.next() < 0.3 ? "L" : "R") : pos === "C" || pos === "2B" || pos === "3B" || pos === "SS" ? "R" : rng.next() < 0.25 ? "L" : "R",
      bats: "R",
    };
    const r = rng.next();
    p.bats = r < 0.38 ? "L" : r < 0.43 ? "S" : "R";
    if (p.throws === "L" && rng.next() < 0.8) p.bats = "L";
    // 特殊能力
    const skills = [];
    const nSkills = tier === "star" ? rng.int(2, 4) : tier === "reg" ? rng.int(0, 2) : rng.int(0, 1);
    for (let i = 0; i < nSkills; i++) {
      let s = rng.pick(BAT_SKILLS_POOL);
      if (s === "steal" && p.speed < 60) s = "chance";
      if (s === "laser" && (p.arm < 65 || ["LF", "CF", "RF"].indexOf(pos) < 0)) s = "throwAcc";
      if (s === "powerHitter" && p.power < 65) s = "firstPitch";
      if (skills.indexOf(s) < 0) skills.push(s);
    }
    if (pos === "C" && p.field >= 60 && rng.next() < 0.5) skills.push("catcher");
    if (tier === "bench" && rng.next() < 0.2) skills.push("chanceX");
    p.skills = skills;
    return p;
  }

  function genArsenal(rng, role, quality, throws) {
    const pools = [
      ["SL", "FK", "CB"],
      ["SL", "CH", "CB"],
      ["CT", "SF", "CB"],
      ["SL", "SK", "CB"],
      ["HS", "FK"],
      ["VS", "CH", "SH"],
      ["SL", "SH", "FK"],
      ["CT", "CH", "SC"],
      ["TS", "SL", "SF"],
    ];
    let pool = rng.pick(pools).slice();
    if (rng.next() < 0.03) pool = ["KN", "SL"];
    const n = role === "SP" ? rng.int(2, 3) : role === "CL" ? rng.int(1, 2) : rng.int(1, 3);
    const out = [];
    for (let i = 0; i < Math.min(n, pool.length); i++) {
      const lv = U.clamp(Math.round(1.5 + quality / 22 + rng.gauss() * 1.1 - i * 0.6), 1, 7);
      out.push({ t: pool[i], lv });
    }
    if (role === "CL" && out[0]) out[0].lv = Math.max(out[0].lv, 5);
    void throws;
    return out;
  }

  function genPitcher(rng, role, tier, style) {
    const sb = STYLE_BIAS[style].pit;
    const q = (tier === "star" ? 74 : tier === "reg" ? 58 : 48) + sb;
    const p = {
      pos: "P",
      role,
      throws: rng.next() < 0.28 ? "L" : "R",
      velo: Math.round(U.clamp(role === "SP" ? 136 + (q - 50) * 0.38 + rng.gauss() * 4 : 140 + (q - 50) * 0.4 + rng.gauss() * 4, 124, 162)),
      control: clampAb(q + rng.gauss() * 10 + (role === "CL" ? 4 : 0)),
      stamina: clampAb(role === "SP" ? 64 + (q - 55) * 0.5 + rng.gauss() * 9 : 30 + rng.gauss() * 8),
      meet: clampAb(20 + rng.gauss() * 8),
      power: clampAb(18 + rng.gauss() * 9),
      speed: clampAb(35 + rng.gauss() * 10),
      arm: clampAb(55 + rng.gauss() * 10),
      field: clampAb(45 + rng.gauss() * 10),
      catch: clampAb(45 + rng.gauss() * 10),
      traj: 1,
    };
    p.bats = p.throws === "L" ? "L" : rng.next() < 0.15 ? "L" : "R";
    p.pitches = genArsenal(rng, role, q, p.throws);
    const skills = [];
    const n = tier === "star" ? rng.int(2, 4) : tier === "reg" ? rng.int(0, 2) : rng.int(0, 1);
    for (let i = 0; i < n; i++) {
      const s = rng.pick(PIT_SKILLS_POOL);
      if (skills.indexOf(s) < 0) skills.push(s);
    }
    p.skills = skills;
    return p;
  }

  function nameGen(rng, used) {
    for (let i = 0; i < 200; i++) {
      const s = rng.pick(D.SURNAMES);
      if (!used.has(s)) {
        used.add(s);
        return { name: s, given: rng.pick(D.GIVEN) };
      }
    }
    const s = rng.pick(D.SURNAMES);
    return { name: s, given: rng.pick(D.GIVEN) };
  }

  // 実在選手の能力をゲームの基準に合わせる補正 (2004 年の打高: 1 試合 4.5 点・打率 .280 前後になるよう調整)
  // team: 球団の戦力差の縮め (D.teamShift)。f = 縮める割合 (0 = 名簿のまま、1 = 主力の能力の平均をリーグ平均にそろえる)。
  //   弾道の差はパワーに (弾道 1 = パワー traj)、変化球のレベルの差はコントロールに (レベル合計 1 = コントロール lv) 換算する。
  //   bench・relief は控えの野手・救援投手の重み (打順の野手・先発は 1)
  D.CALIB = { meet: -5, power: 4, speed: 10, lv: -1, velo: 0, control: -7, team: { f: 0, cap: 1, traj: 9.5, lv: 6, bench: 0.1, relief: 0.4 } };
  // 補正を変えたら上げる (保存済みのチームの能力を作り直す目印)
  D.CALIB_VER = 3;
  D.RATING_KEYS = ["meet", "power", "speed", "arm", "field", "catch", "traj", "velo", "control", "stamina", "pitches"];

  // 名簿の球団の主力の能力の平均 (名簿の能力そのまま。打順の野手・先発は重み 1、控え・救援は CALIB.team の重み)
  const nameKey = (n) => String(n || "").replace(/[ 　]/g, "");
  function rosterMeans(ro, T) {
    const inLineup = new Set((ro.lineup || []).map((e) => nameKey(e.name)));
    const inRot = new Set((ro.rotation || []).map(nameKey));
    const sum = { meet: 0, power: 0, speed: 0, traj: 0, velo: 0, control: 0, lvs: 0 };
    const wb = { bat: 0, pit: 0 };
    for (const r of ro.players || []) {
      const a = r.r || {};
      const pit = r.pos === "P";
      const main = pit ? (inRot.size ? inRot.has(nameKey(r.name)) : r.role === "SP") : inLineup.has(nameKey(r.name));
      const w = main ? 1 : pit ? (T.relief != null ? T.relief : 0.4) : T.bench != null ? T.bench : 0.1;
      if (pit) {
        wb.pit += w;
        sum.velo += w * (a.velo || 140);
        sum.control += w * (a.control || 50);
        sum.lvs += w * (a.pitches || []).reduce((x, q) => x + q.lv, 0);
      } else {
        wb.bat += w;
        sum.meet += w * (a.meet || 40);
        sum.power += w * (a.power || 40);
        sum.speed += w * (a.speed || 45);
        sum.traj += w * (a.traj || 2);
      }
    }
    const m = {};
    for (const k in sum) m[k] = sum[k] / Math.max(1e-9, ["velo", "control", "lvs"].indexOf(k) >= 0 ? wb.pit : wb.bat);
    return m;
  }
  // 球団の戦力差を縮めるために、その球団の選手全員をずらす量 { meet, power, speed, velo, control }。
  // 能力ごとに、同じリーグの名簿の球団の平均との差 x を x × (1 - f) / (1 + |x| / (cap × σ)) に縮める
  // (σ: 12 球団の差の大きさの平均。差が大きい球団ほど強く縮める。球団内の差・看板選手・弾道・持ち球はそのまま)
  D.teamShift = function (id) {
    const T = (D.CALIB && D.CALIB.team) || {};
    const R = D.ROSTERS || {};
    if (!R[id] || (!T.f && !T.cap)) return {};
    const lgOf = (x) => (D.teamDef && D.teamDef(x) && D.teamDef(x).lg) || "";
    const ids = Object.keys(R);
    const means = {};
    for (const x of ids) {
      const m = rosterMeans(R[x], T);
      // 弾道はパワーに、変化球のレベルはコントロールに換算
      means[x] = { meet: m.meet, power: m.power + (T.traj || 0) * m.traj, speed: m.speed, velo: m.velo, control: m.control + (T.lv || 0) * m.lvs };
    }
    const dev = (x, k) => {
      const same = ids.filter((y) => lgOf(y) === lgOf(x));
      return means[x][k] - same.reduce((s, y) => s + means[y][k], 0) / same.length;
    };
    const out = {};
    for (const k in means[id]) {
      const x = dev(id, k);
      const sig = Math.sqrt(ids.reduce((s, y) => s + dev(y, k) ** 2, 0) / ids.length) || 1;
      const c = T.cap ? T.cap * sig : Infinity;
      out[k] = (x * (1 - (T.f || 0))) / (1 + Math.abs(x) / c) - x;
    }
    return out;
  };

  // 実在選手の名簿 (rosters2004.js) からチームを作る
  D.rosterTeam = function (tdef, ro) {
    const rng = U.seeded(tdef.seed || 1);
    const sh = D.teamShift(tdef.id);
    const players = ro.players.map((r, i) => {
      const nm = String(r.name || "");
      let name = nm;
      let given = "";
      if (nm.indexOf(" ") > 0) {
        [name, given] = nm.split(" ");
      } else if (nm.indexOf("・") > 0) {
        const parts = nm.split("・");
        name = parts[parts.length - 1];
        given = parts.slice(0, -1).join("・");
      }
      // 能力の補正 (ゲームの打高・投高のバランスに合わせる) と球団の戦力差の縮め (sh)
      const C = D.CALIB || {};
      const a0 = r.r || {};
      const a = Object.assign({}, a0);
      if (r.pos !== "P") {
        a.meet = (a0.meet || 40) + (C.meet || 0) + (sh.meet || 0);
        a.power = (a0.power || 40) + (C.power || 0) + (sh.power || 0);
        a.speed = (a0.speed || 45) + (C.speed || 0) + (sh.speed || 0);
      }
      if (r.pos === "P") {
        a.velo = (a0.velo || 140) + (C.velo || 0) + (sh.velo || 0);
        a.control = (a0.control || 50) + (C.control || 0) + (sh.control || 0);
        a.pitches = (a0.pitches || []).map((x) => ({ t: x.t, lv: x.lv + (C.lv || 0) }));
      }
      const p = {
        id: tdef.id + "_" + i,
        name,
        given,
        full: nm.replace(" ", ""),
        kana: r.kana,
        nameEn: r.nameEn,
        num: r.num,
        pos: r.pos,
        bats: r.bats || "R",
        throws: r.throws || "R",
        age: r.age,
        foreign: !!r.foreign,
        meet: clampAb(a.meet || 40),
        power: clampAb(a.power || 40),
        speed: clampAb(a.speed || 45),
        arm: clampAb(a.arm || 50),
        field: clampAb(a.field || 50),
        catch: clampAb(a.catch || 50),
        traj: U.clamp(a.traj || 2, 1, 4),
        skills: (r.skills || []).filter((k) => D.SKILLS[k]),
        real: { stats: r.stats || {}, season: ro.season },
      };
      if (r.pos === "P") {
        p.role = r.role || "RP";
        p.velo = Math.round(U.clamp(a.velo || 140, 115, 165));
        p.control = clampAb(a.control || 50);
        p.stamina = clampAb(a.stamina || (p.role === "SP" ? 65 : 35));
        p.pitches = (a.pitches || []).filter((x) => D.PITCHES[x.t] && x.t !== "FB").map((x) => ({ t: x.t, lv: U.clamp(x.lv | 0, 1, 7) }));
      }
      p.face = genFace(rng);
      if (p.foreign) p.face.skin = D.SKINS[3];
      return p;
    });
    const team = Object.assign({}, tdef, { players, manager: ro.manager });
    const byName = (n) => players.find((p) => p.full === String(n || "").replace(" ", ""));
    // 打順 (セ・リーグは投手が 9 番)
    const order = (ro.lineup || []).map((e) => {
      const p = byName(e.name);
      return p ? { id: p.id, pos: e.pos } : null;
    });
    if (order.length === 9 && order.every(Boolean)) {
      team.lineup = order;
      const used = new Set(order.map((e) => e.id));
      team.bench = players.filter((p) => p.pos !== "P" && !used.has(p.id)).map((p) => p.id);
      const rot = (ro.rotation || []).map(byName).filter(Boolean);
      team.rotation = rot.length ? rot.map((p) => p.id) : players.filter((p) => p.role === "SP").map((p) => p.id);
      const cl = byName(ro.closer);
      team.closer = cl ? cl.id : null;
      team.bullpen = players.filter((p) => p.pos === "P" && team.rotation.indexOf(p.id) < 0).sort((a, b) => (a.id === team.closer ? 1 : 0) - (b.id === team.closer ? 1 : 0)).map((p) => p.id);
      team.rotIdx = 0;
    } else D.autoOrder(team);
    // 投手の打順に入る先発
    for (const e of team.lineup) if (e.pos === "P") e.id = team.rotation[0];
    return team;
  };

  // 試合の DH 制に合わせた打順 (DH あり ⇔ 投手が打つ)
  D.lineupFor = function (team, dh) {
    const L = team.lineup.map((e) => Object.assign({}, e));
    const pi = L.findIndex((e) => e.pos === "P");
    const di = L.findIndex((e) => e.pos === "DH");
    if (dh && pi >= 0) {
      const used = new Set(L.map((e) => e.id));
      const best = (team.bench || []).map((id) => team.players.find((p) => p.id === id)).filter((p) => p && !used.has(p.id)).sort((a, b) => D.batOverall(b) - D.batOverall(a))[0];
      if (best) L[pi] = { id: best.id, pos: "DH" };
    } else if (!dh && di >= 0) {
      L.splice(di, 1);
      L.push({ id: team.rotation[0], pos: "P" });
    }
    return L;
  };

  D.generateTeam = function (tdef) {
    if (D.ROSTERS && D.ROSTERS[tdef.id]) return D.rosterTeam(tdef, D.ROSTERS[tdef.id]);
    const rng = U.seeded(tdef.seed);
    const style = tdef.style;
    const used = new Set();
    const nums = new Set();
    const takeNum = (pref) => {
      for (const n of pref) {
        if (!nums.has(n)) {
          nums.add(n);
          return n;
        }
      }
      for (let i = 0; i < 300; i++) {
        const n = rng.int(0, 99);
        if (!nums.has(n)) {
          nums.add(n);
          return n;
        }
      }
      return 99;
    };
    const players = [];
    const starBat = STYLE_BIAS[style].star === "bat" ? 2 : 1;
    const starPos = U.shuffle(["1B", "3B", "LF", "RF", "CF", "SS", "DH"], rng.next).slice(0, starBat);
    // 野手スタメン
    const lineupPos = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
    for (const pos of lineupPos) {
      const tier = starPos.indexOf(pos) >= 0 ? "star" : "reg";
      const p = genBatter(rng, pos, tier, style);
      Object.assign(p, nameGen(rng, used));
      p.num = takeNum(tier === "star" ? [rng.pick([1, 3, 5, 6, 7, 8, 9, 10, 25, 55])] : [rng.int(0, 69)]);
      players.push(p);
    }
    // ベンチ
    for (const pos of ["C", "2B", "SS", "CF", "1B"]) {
      const p = genBatter(rng, pos, "bench", style);
      Object.assign(p, nameGen(rng, used));
      p.num = takeNum([rng.int(30, 69)]);
      p.bench = true;
      players.push(p);
    }
    // 投手
    const roles = ["SP", "SP", "SP", "SP", "SP", "RP", "RP", "RP", "RP", "CL"];
    roles.forEach((role, i) => {
      const tier = i === 0 && (STYLE_BIAS[style].star === "pit" || rng.next() < 0.5) ? "star" : i === 9 ? "reg" : i < 3 ? "reg" : "bench";
      const p = genPitcher(rng, role, tier, style);
      Object.assign(p, nameGen(rng, used));
      p.num = takeNum(i === 0 ? [18, 11, 17] : i === 9 ? [rng.int(20, 29)] : [rng.int(11, 29), rng.int(40, 69)]);
      players.push(p);
    });
    players.forEach((p, i) => {
      p.id = tdef.id + "_" + i;
      p.face = genFace(rng);
      p.full = p.name + " " + p.given;
    });
    const team = Object.assign({}, tdef, { players });
    D.autoOrder(team);
    return team;
  };

  // 架空の選手を 1 人作る (ペナントの二軍など)。o = { pos, role, tier, style, used (使った姓の Set) }。id・背番号は呼ぶ側で付ける
  D.genPlayer = function (rng, o) {
    const opt = o || {};
    const style = STYLE_BIAS[opt.style] ? opt.style : "contact";
    const p = opt.pos === "P" ? genPitcher(rng, opt.role || "RP", opt.tier || "bench", style) : genBatter(rng, POS_BIAS[opt.pos] ? opt.pos : "LF", opt.tier || "bench", style);
    Object.assign(p, nameGen(rng, opt.used || new Set()));
    p.face = genFace(rng);
    return p;
  };

  D.batOverall = (p) => p.meet * 1.2 + p.power * 1.2 + p.speed * 0.6 + p.field * 0.4 + p.arm * 0.3 + p.catch * 0.2;
  D.pitOverall = (p) => (p.velo - 120) * 1.6 + p.control * 0.9 + p.stamina * 0.25 + p.pitches.reduce((a, b) => a + b.lv * 5, 0);

  D.overallRank = function (p) {
    if (p.pos === "P") {
      const v = U.clamp((D.pitOverall(p) - 40) / 1.55, 1, 100);
      return D.rank(v);
    }
    const v = U.clamp((D.batOverall(p) - 90) / 2.4, 1, 100);
    return D.rank(v);
  };

  // 打順・守備・ローテーションを自動編成
  D.autoOrder = function (team) {
    const bats = team.players.filter((p) => p.pos !== "P");
    const pits = team.players.filter((p) => p.pos === "P");
    // 守備位置: 各ポジション最高評価
    const need = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
    const assigned = {};
    const usedIds = new Set();
    for (const pos of need) {
      const cands = bats.filter((p) => !usedIds.has(p.id) && p.pos === pos).sort((a, b) => D.batOverall(b) - D.batOverall(a));
      const pick = cands[0] || bats.filter((p) => !usedIds.has(p.id)).sort((a, b) => b.field - a.field)[0];
      assigned[pos] = pick;
      usedIds.add(pick.id);
    }
    const rest = bats.filter((p) => !usedIds.has(p.id)).sort((a, b) => b.meet + b.power * 1.3 - (a.meet + a.power * 1.3));
    assigned.DH = rest[0];
    usedIds.add(rest[0].id);
    const nine = Object.keys(assigned).map((pos) => ({ id: assigned[pos].id, pos }));
    const byId = (id) => team.players.find((p) => p.id === id);
    const score = {
      lead: (p) => p.speed * 1.2 + p.meet,
      two: (p) => p.meet * 1.3 + p.speed * 0.4,
      three: (p) => p.meet + p.power,
      four: (p) => p.power * 1.6 + p.meet * 0.4,
    };
    const pool = nine.slice();
    const takeBest = (fn) => {
      pool.sort((a, b) => fn(byId(b.id)) - fn(byId(a.id)));
      return pool.shift();
    };
    const order = [];
    const cleanup = takeBest(score.four);
    const third = takeBest(score.three);
    const fifth = takeBest(score.four);
    const lead = takeBest(score.lead);
    const two = takeBest(score.two);
    const restOrder = pool.sort((a, b) => score.three(byId(b.id)) - score.three(byId(a.id)));
    order.push(lead, two, third, cleanup, fifth, ...restOrder);
    team.lineup = order;
    team.bench = bats.filter((p) => !nine.some((n) => n.id === p.id)).map((p) => p.id);
    const sps = pits.filter((p) => p.role === "SP").sort((a, b) => D.pitOverall(b) - D.pitOverall(a));
    team.rotation = sps.map((p) => p.id);
    team.bullpen = pits.filter((p) => p.role !== "SP").sort((a, b) => (a.role === "CL" ? 1 : 0) - (b.role === "CL" ? 1 : 0)).map((p) => p.id);
    team.closer = (pits.find((p) => p.role === "CL") || {}).id || null;
    team.rotIdx = team.rotIdx || 0;
    return team;
  };

  D.player = (team, id) => team.players.find((p) => p.id === id);

  D.newTeams = function () {
    return D.TEAMS.map((t) => D.generateTeam(t));
  };

  PB.D = D;
})((window.PB = window.PB || {}));
