/* 熱闘！ポケットベースボール — サクセス (選手育成)
 * 2月のキャンプから7月の一軍昇格テストまでの24週。練習で経験点をため、能力に振り分ける。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const UI = PB.UI;
  const Store = PB.Store;
  const Sc = PB.Screens;
  const A = PB.Audio;
  const esc = U.esc;
  const Su = {};

  const TOTAL = 24;
  const MOODS = ["絶不調", "不調", "普通", "好調", "絶好調"];
  const MOOD_MUL = [0.6, 0.8, 1.0, 1.2, 1.4];
  const EXP = { str: "筋力", agi: "敏捷", tec: "技術", brk: "変化球", men: "精神" };

  // 仲間キャラクター (オリジナル)。絵は PB.Manga (manga.js)、desc は紹介カードの文、line は「人物」で見せる決め台詞、sig はそのときの表情
  const CAST = {
    goda: { name: "剛田", full: "剛田 鉄平", role: "パワー自慢の先輩", banner: "#d9480f", sig: "happy", color: { main: "#5b6b7d", sub: "#fff", cap: "#2f3a46", mark: "G" }, desc: ["寮の主（ぬし）と呼ばれる、パワー自慢の先輩。", "豪快で面倒見がよく、後輩を見るとメシに誘わずにいられない。", "鼻のばんそうこうは、なぜか一年中はがれない。"], line: "腹が減っては野球はできねえ！メシ行くぞ！" },
    hayase: { name: "早瀬", full: "早瀬 ひかり", role: "チームのマネージャー", banner: "#e8457c", sig: "happy", color: { main: "#f28fb0", sub: "#fff", cap: "#c2416b", mark: "H" }, desc: ["チームを支える元気なマネージャー。", "スコアブックとはちみつレモンは、いつも持ち歩いている。", "ちょっとおせっかいだけど、みんなの調子を一番よく知っている。"], line: "困ったことがあったら、なんでも言ってね！" },
    inukai: { name: "宇佐美", full: "宇佐美 コーチ", role: "理論派の打撃コーチ", banner: "#1f7a6d", sig: "normal", color: { main: "#3b5f8a", sub: "#ffd23f", cap: "#1d3557", mark: "I" }, desc: ["データと理論で教える二軍のコーチ。", "教え方は静かだが、言うことはいつも的確。", "メガネが光ったら、本気で考えているしるしだ。"], line: "フォームには必ず理由がある。考えて振りなさい。" },
    ryuzaki: { name: "竜崎", full: "竜崎 レン", role: "同期のライバル", banner: "#5b3fc4", sig: "normal", color: { main: "#2b2d42", sub: "#ef233c", cap: "#111", mark: "R" }, desc: ["同じ年に入団した、ドラフト1位のエリート。", "クールで負けずぎらい。だれよりも遅くまで練習している。", "一軍の席をかけて争う、最大のライバル。"], line: "一軍に上がるのはオレだ。追いつけるもんなら、追いついてみな。" },
    kanto: { name: "鬼瓦", full: "鬼瓦 監督", role: "チームの監督", banner: "#2d3a55", sig: "normal", color: { main: "#444", sub: "#fff", cap: "#222", mark: "K" }, desc: ["二軍をあずかる、きびしくも情に厚い監督。", "口数は少ないが、選手の努力は誰よりも見ている。", "笑うと目じりのしわが深くなる。それを見た選手は、まだ少ない。"], line: "結果で見せてみろ。お前ならできるはずだ。" },
  };
  const CAST_ORDER = ["kanto", "goda", "hayase", "inukai", "ryuzaki"];
  const MG = PB.Manga;

  /* ---------- キャラクターの絵 (アニメ塗り) ---------- */
  // 仲間はいま育成中の選手のチームの帽子・ユニフォーム (育成中でなければ無地の帽子)
  function castTeam() {
    const r = run();
    return r ? Store.team(r.team) : null;
  }
  function castPic(who, ex, o) {
    return MG.svg(who, Object.assign({ team: castTeam(), ex: ex || "normal", label: CAST[who] ? CAST[who].full : "" }, o));
  }
  // sil: まだ会っていない人はシルエット
  function castIcon(who, ex, sil) {
    return MG.icon(who, { team: castTeam(), ex, sil });
  }
  // 自分の顔: やる気・ケガで表情が変わる
  function mePic(p, team, ex, o) {
    return MG.svg("me", Object.assign({ team, ex: ex || "normal", face: p.face || {}, seed: p.id, label: p.full || "" }, o));
  }
  function moodFace(r) {
    if (r.injured || r.mood <= 0) return "sad";
    if (r.mood >= 4) return "happy";
    return "normal";
  }
  // 会ったことのある人 (紹介カードを見せたか)。紹介カードより前のセーブには met がないので、全員と会っている扱いにする
  function metOf(r) {
    if (r && !r.met) r.met = Object.fromEntries(CAST_ORDER.map((k) => [k, true]));
    return r ? r.met : {};
  }
  function met(r, who) {
    return !!metOf(r)[who];
  }
  function markMet(r, who) {
    metOf(r)[who] = true;
    Store.save();
  }

  const PR_BAT = [
    { k: "bat", name: "打撃", exp: { tec: 9, str: 3 }, hp: 18 },
    { k: "pow", name: "筋力", exp: { str: 11, men: 1 }, hp: 22 },
    { k: "run", name: "走塁", exp: { agi: 10, tec: 1 }, hp: 18 },
    { k: "def", name: "守備", exp: { tec: 5, agi: 6 }, hp: 16 },
    { k: "men", name: "精神", exp: { men: 9, tec: 2 }, hp: 8 },
  ];
  const PR_PIT = [
    { k: "pitch", name: "投球", exp: { tec: 7, brk: 4 }, hp: 18 },
    { k: "pow", name: "筋力", exp: { str: 11, men: 1 }, hp: 22 },
    { k: "run", name: "走り込み", exp: { agi: 7, men: 4 }, hp: 20 },
    { k: "brk", name: "変化球", exp: { brk: 11, tec: 2 }, hp: 16 },
    { k: "men", name: "精神", exp: { men: 9, brk: 2 }, hp: 8 },
  ];

  // 試合イベント (週)
  const GAMES = {
    6: { name: "紅白戦", pa: 2, bf: 4, opp: "same" },
    12: { name: "オープン戦", pa: 2, bf: 4 },
    18: { name: "二軍戦", pa: 3, bf: 5 },
    23: { name: "一軍昇格テスト", pa: 3, bf: 6, final: true },
  };

  function run() {
    return Store.data.success.run;
  }
  function isP(r) {
    return r.player.pos === "P";
  }
  function dateText(t) {
    return 2 + Math.floor(t / 4) + "月 " + ((t % 4) + 1) + "週";
  }

  /* ---------- 新規作成 ---------- */
  Su.newRun = function (o) {
    const team = Store.team(o.team);
    const isPitcher = o.pos === "P";
    const p = {
      id: U.uid("sx"),
      name: o.name,
      given: o.given || "",
      full: o.name + (o.given ? " " + o.given : ""),
      pos: o.pos,
      throws: o.throws,
      bats: o.bats,
      num: o.num || 0,
      face: { skin: o.skin, eyes: o.eyes, brow: o.brow || 0, cheek: false, hair: "#2b1b14", hs: Number(o.hs) || 0 },
      custom: true,
      skills: [],
      traj: isPitcher ? 1 : 2,
      meet: isPitcher ? 15 : 32,
      power: isPitcher ? 15 : 32,
      speed: isPitcher ? 35 : 42,
      arm: isPitcher ? 55 : 42,
      field: isPitcher ? 40 : 36,
      catch: isPitcher ? 40 : 36,
    };
    if (isPitcher) {
      p.velo = 128;
      p.control = 35;
      p.stamina = 40;
      p.pitches = [{ t: o.pitch || "SL", lv: 1 }];
      p.role = "SP";
    }
    Store.data.success.run = {
      player: p,
      team: team.id,
      turn: 0,
      hp: 100,
      mood: 2,
      exp: { str: 20, agi: 20, tec: 20, brk: isPitcher ? 20 : 0, men: 20 },
      eval: 20,
      rel: { goda: 10, hayase: 10, inukai: 10, ryuzaki: 5 },
      plv: {},
      injured: 0,
      flags: {},
      log: [],
      helpers: {},
      gameLog: [],
      met: {},
    };
    Store.save();
    return Store.data.success.run;
  };

  /* ---------- 練習 ---------- */
  function rollHelpers(r) {
    const keys = ["goda", "hayase", "inukai", "ryuzaki"];
    const prs = isP(r) ? PR_PIT : PR_BAT;
    const h = {};
    for (const k of keys) {
      if (Math.random() < 0.55) {
        const pr = U.pick(prs);
        (h[pr.k] = h[pr.k] || []).push(k);
      }
    }
    r.helpers = h;
  }

  function practiceGain(r, pr) {
    const lv = r.plv[pr.k] || 1;
    const helpers = r.helpers[pr.k] || [];
    const mul = MOOD_MUL[r.mood] * (1 + (lv - 1) * 0.1) * (1 + helpers.length * 0.4);
    const out = {};
    for (const k in pr.exp) out[k] = Math.round(pr.exp[k] * mul * 1.35);
    return out;
  }

  function addExp(r, g) {
    for (const k in g) r.exp[k] = Math.max(0, (r.exp[k] || 0) + g[k]);
  }

  function gainText(g) {
    return Object.keys(g)
      .filter((k) => g[k])
      .map((k) => EXP[k] + (g[k] > 0 ? "+" : "") + g[k])
      .join(" ");
  }

  Su.doPractice = function (r, key) {
    const prs = isP(r) ? PR_PIT : PR_BAT;
    const msgs = [];
    if (key === "rest") {
      const v = U.randi(35, 55);
      r.hp = Math.min(100, r.hp + v);
      msgs.push("ゆっくり休んだ。体力が " + v + " 回復した。");
      if (Math.random() < 0.3 && r.mood < 4) {
        r.mood++;
        msgs.push("気分もすっきり！やる気が上がった。");
      }
    } else if (key === "play") {
      r.hp = Math.min(100, r.hp + 10);
      const up = Math.random() < 0.7 ? 2 : 1;
      r.mood = Math.min(4, r.mood + up);
      r.rel.hayase += 3;
      msgs.push(U.pick(["バッティングセンターで気分転換！", "仲間とカラオケで盛り上がった！", "商店街の食べ歩きを楽しんだ！"]) + " やる気が上がった。");
    } else {
      const pr = prs.find((x) => x.k === key);
      // ケガ判定
      const risk = r.hp < 50 ? (50 - r.hp) * 1.5 : 0;
      if (Math.random() * 100 < risk) {
        r.hp = Math.max(0, r.hp - 10);
        r.mood = Math.max(0, r.mood - 1);
        r.injured = 2;
        msgs.push("うっ…！ 練習中に足をひねってしまった。2週間は練習できない…");
        A.groan();
      } else {
        const g = practiceGain(r, pr);
        addExp(r, g);
        r.hp = Math.max(0, r.hp - pr.hp);
        r.plv[key] = Math.min(5, (r.plv[key] || 1) + 0.34);
        r.eval += 1;
        const helpers = r.helpers[key] || [];
        for (const h of helpers) r.rel[h] += 9;
        msgs.push(pr.name + "練習をがんばった！ " + gainText(g));
        if (helpers.length) msgs.push(helpers.map((h) => CAST[h].name).join("・") + " と一緒に練習した。");
      }
    }
    return msgs;
  };

  /* ---------- イベント ---------- */
  // face: 表情 (省略すると台詞から決める。PB.Manga.faceOf)
  function ev(who, text, choices, face) {
    return { who, text, choices, face };
  }
  const RANDOM_EVENTS = [
    (r) => ev("hayase", "練習おつかれさま！はちみつレモン作ってきたよ。", [{ t: "ありがとう！", f: () => ((r.hp = Math.min(100, r.hp + 15)), (r.rel.hayase += 5), "体力+15") }]),
    (r) =>
      ev(null, "夜、寮の庭は静まりかえっている。どうしよう？", [
        { t: "素振り（シャドー）をする", f: () => (addExp(r, isP(r) ? { brk: 8, tec: 4 } : { tec: 10, str: 2 }), (r.hp = Math.max(0, r.hp - 10)), "経験点アップ 体力-10") },
        { t: "早く寝る", f: () => ((r.hp = Math.min(100, r.hp + 12)), "体力+12") },
      ]),
    (r) =>
      ev("goda", "おい新人！ラーメン食いに行くぞ！大盛りおごってやる！", [
        { t: "行きます！", f: () => ((r.mood = Math.min(4, r.mood + 1)), (r.rel.goda += 8), (r.hp = Math.min(100, r.hp + 5)), "やる気アップ 剛田と仲良くなった") },
        { t: "今日は遠慮します", f: () => (addExp(r, { men: 6 }), "精神+6") },
      ]),
    (r) => ev("inukai", isP(r) ? "リリースポイントがばらついているな。指先の感覚を意識してみなさい。" : "トップの位置が浅い。もう少し懐を深くしてみなさい。", [{ t: "やってみます", f: () => (addExp(r, isP(r) ? { tec: 8, brk: 4 } : { tec: 10 }), (r.rel.inukai += 5), "技術アップ") }], "serious"),
    (r) =>
      ev(
        "ryuzaki",
        "よう、調子はどうだ？…ま、一軍に上がるのはオレだけどな。",
        [
          { t: "負けないぞ！", f: () => (addExp(r, { men: 8 }), (r.rel.ryuzaki += 7), "精神+8") },
          { t: "……（無視する）", f: () => (addExp(r, { men: 3 }), "精神+3") },
        ],
        "normal"
      ),
    (r) => ev(null, "大雨で練習が中止になった。部屋でゆっくり過ごした。", [{ t: "OK", f: () => ((r.hp = Math.min(100, r.hp + 20)), "体力+20") }]),
    (r) => ev(null, "ファンの子どもから手紙が届いた。『いつか一軍でホームラン見せてね！』", [{ t: "がんばるぞ！", f: () => ((r.mood = Math.min(4, r.mood + 1)), "やる気アップ") }]),
    (r) => ev("kanto", "……最近、よく練習しているな。その調子で、結果でも見せてみろ。", [{ t: "はい！", f: () => ((r.eval += r.mood >= 3 ? 6 : 2), "監督の評価が上がった") }], "normal"),
    (r) =>
      ev(null, "ビデオ研究室が空いている。何を見よう？", [
        { t: "自分のフォーム", f: () => (addExp(r, { tec: 7 }), "技術+7") },
        { t: "一軍の試合", f: () => (addExp(r, { men: 7 }), "精神+7") },
      ]),
    (r) => ev(null, "全身がひどい筋肉痛だ…。", [{ t: "うう…", f: () => ((r.hp = Math.max(0, r.hp - 10)), "体力-10") }]),
    (r) => ev("goda", "寮の大掃除だ！新人は廊下の雑巾がけ百往復な！", [{ t: "はいっ！", f: () => (addExp(r, { agi: 6, men: 2 }), (r.hp = Math.max(0, r.hp - 6)), "敏捷+6 精神+2") }]),
    (r) => ev("hayase", "スコアブックの付け方、教えてくれる？…わたし、もっと選手の役に立ちたいんだ。", [{ t: "一緒にやろう", f: () => ((r.rel.hayase += 8), addExp(r, { men: 4 }), "早瀬と仲良くなった") }], "normal"),
    (r) => ev(null, "なんだか体が重い…スランプかもしれない。", [{ t: "…", f: () => ((r.mood = Math.max(0, r.mood - 1)), "やる気ダウン") }]),
  ];

  // 仲間との絆イベント
  function bondEvent(r) {
    const P = isP(r);
    const defs = {
      goda: [
        { at: 40, who: "goda", text: "お前、根性あるな！オレの秘密の特訓に付き合え！タイヤ引きだ！", gain: { str: 25 }, msg: "筋力+25" },
        { at: 80, who: "goda", text: "もう教えることはねえ。オレの全部、持っていけ！", skill: P ? "heavy" : "powerHitter", face: "happy" },
      ],
      hayase: [
        { at: 40, who: "hayase", text: "これ、みんなの分のお守り。…あなたのは、ちょっとだけ特別だよ。", hp: 30, mood: 4, msg: "体力回復・やる気最高", face: "happy" },
        { at: 80, who: "hayase", text: "大事な場面ほど、いつものあなたでいて。わたし、ずっと見てるから。", skill: P ? "pinch" : "chance", face: "happy" },
      ],
      inukai: [
        { at: 40, who: "inukai", text: "基本を徹底的に見直そう。今日は一日、私のメニューだ。", gain: { tec: 25 }, msg: "技術+25" },
        { at: 80, who: "inukai", text: "君の理論はもう完成している。自信を持ちなさい。", skill: P ? "kire" : "avgHitter", face: "happy" },
      ],
      ryuzaki: [
        { at: 40, who: "ryuzaki", text: "…悪くない。だが勝つのはオレだ。今日の居残り、付き合えよ。", gain: { str: 8, agi: 8, tec: 8, men: 8 }, msg: "経験点アップ", face: "normal" },
        { at: 80, who: "ryuzaki", text: "認めてやる。お前は最高のライバルだ。一軍で待ってるぜ。", skill: P ? "k" : "spray", ev: 10, face: "happy" },
      ],
    };
    for (const k in defs) {
      for (const d of defs[k]) {
        const flag = k + d.at;
        if (r.rel[k] >= d.at && !r.flags[flag]) {
          r.flags[flag] = true;
          return ev(
            d.who,
            d.text,
            [
              {
                t: "ありがとうございます！",
                f: () => {
                  if (d.gain) addExp(r, d.gain);
                  if (d.hp) r.hp = Math.min(100, r.hp + d.hp);
                  if (d.mood != null) r.mood = d.mood;
                  if (d.ev) r.eval += d.ev;
                  if (d.skill && r.player.skills.indexOf(d.skill) < 0) {
                    r.player.skills.push(d.skill);
                    return "特殊能力「" + D.SKILLS[d.skill].name + "」を習得！";
                  }
                  return d.msg || "";
                },
              },
            ],
            d.face
          );
        }
      }
    }
    return null;
  }

  /* ---------- 能力アップのコスト ---------- */
  const BAT_UP = [
    { k: "meet", name: "ミート", cost: { tec: 4, str: 1 } },
    { k: "power", name: "パワー", cost: { str: 4, tec: 1 } },
    { k: "speed", name: "走力", cost: { agi: 4 } },
    { k: "arm", name: "肩力", cost: { str: 2, agi: 2 } },
    { k: "field", name: "守備力", cost: { tec: 2, agi: 2 } },
    { k: "catch", name: "捕球", cost: { tec: 2, men: 1 } },
  ];
  const PIT_UP = [
    { k: "velo", name: "球速", cost: { str: 5, agi: 1 }, max: 165, step: 1 },
    { k: "control", name: "コントロール", cost: { tec: 4, brk: 1 } },
    { k: "stamina", name: "スタミナ", cost: { agi: 2, men: 2 } },
  ];
  const SKILL_SHOP_BAT = ["chance", "powerHitter", "avgHitter", "spray", "steal", "baserun", "infieldHit", "eye", "laser", "throwAcc", "clutch", "firstPitch"];
  const SKILL_SHOP_PIT = ["nobi", "kire", "k", "pinch", "vsLeftP", "heavy", "quick", "lateGood", "low", "tough", "hold"];

  function upCost(r, def) {
    const p = r.player;
    const v = p[def.k];
    let scale;
    if (def.k === "velo") scale = 1 + Math.max(0, v - 125) / 12;
    else scale = 1 + v / 60;
    const out = {};
    const step = def.k === "velo" ? 1 : 2;
    for (const k in def.cost) out[k] = Math.ceil(def.cost[k] * scale * step);
    return out;
  }
  function trajCost(r) {
    const t = r.player.traj;
    return { str: 30 + t * 15, men: 15 + t * 5 };
  }
  function pitchCost(lv) {
    return { brk: 14 + lv * 9, tec: 4 + lv * 2 };
  }
  function newPitchCost(r) {
    return { brk: 28 + r.player.pitches.length * 14, tec: 10 };
  }
  function skillCost(r) {
    const n = r.player.skills.length;
    return { men: 25 + n * 8, tec: 12 + n * 4 };
  }
  function canPay(r, c) {
    return Object.keys(c).every((k) => (r.exp[k] || 0) >= c[k]);
  }
  function pay(r, c) {
    for (const k in c) r.exp[k] -= c[k];
  }
  function costText(c) {
    return Object.keys(c)
      .map((k) => EXP[k][0] + c[k])
      .join(" ");
  }

  /* ---------- 画面: メニュー ---------- */
  Su.menu = function () {
    return {
      html() {
        const r = run();
        const list = Store.data.success.players;
        return (
          UI.header("サクセス", "back") +
          // 監督の絵とふきだし。絵をタップすると紹介カード
          '<div class="scr-body"><div class="su-hero mg-hero"><button class="mg-hero-pic" data-act="cast" data-arg="kanto" aria-label="鬼瓦監督の紹介">' +
          castPic("kanto", "normal", { size: 140 }) +
          '</button><p class="mg-say">「7月の一軍昇格テストまでに、結果を出してみせろ。努力はちゃんと見ているぞ。」<small>— 鬼瓦監督</small></p></div>' +
          (r ? '<button class="mbtn red" data-act="continue"><b>続きから</b><small>' + esc(r.player.full) + " / " + dateText(r.turn) + "</small></button>" : "") +
          '<button class="mbtn' +
          (r ? "" : " red") +
          '" data-act="new"><b>新しく始める</b><small>' +
          (r ? "いまの育成データは消えます" : "選手をつくって入団") +
          "</small></button>" +
          '<h3 class="lbl">完成した選手 (' +
          list.length +
          ')</h3><div class="olist">' +
          (list.length
            ? list
                .map((p, i) => {
                  const ov = D.overallRank(p);
                  const where = UI.findPlayer(p.id);
                  return '<button class="orow" data-act="pl" data-arg="' + i + '"><span class="on-p">' + D.POS_JP[p.pos] + '</span><b>' + esc(p.full) + '</b><span class="ovs" style="color:' + ov.color + '">' + ov.r + "</span>" + Sc.abMini(p) + '<span class="sl">' + (where ? esc(where.team.short) + "所属" : "未登録") + "</span></button>";
                })
                .join("")
            : '<p class="muted">まだ選手がいません</p>') +
          '</div><div class="row-btns"><button class="btn" data-act="import">パスワード入力</button></div></div>'
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Sc.title());
        if (act === "cast") return Su.introCard(arg, CAST[arg].line, CAST[arg].sig);
        if (act === "continue") return UI.go(Su.turnScreen());
        if (act === "new") {
          if (run()) return UI.confirm("育成中の選手のデータは消えます。新しく始めますか？", () => UI.go(Su.create()), { yes: "始める", danger: true });
          return UI.go(Su.create());
        }
        if (act === "pl") return Su.playerMenu(Number(arg));
        if (act === "import") return Su.importModal();
      },
    };
  };

  Su.playerMenu = function (i) {
    const p = Store.data.success.players[i];
    const where = UI.findPlayer(p.id);
    const team = where ? where.team : Store.team("t");
    UI.modal(
      UI.playerCard(where ? where.p : p, team) +
        '<div class="col-btns"><button class="btn" data-act="reg">' +
        (where ? "所属チームを変更" : "チームに登録") +
        "</button>" +
        (where ? '<button class="btn" data-act="unreg">チームから外す</button>' : "") +
        '<button class="btn" data-act="code">パスワードを表示</button><button class="btn red" data-act="del">削除</button><button class="btn primary" data-act="close">とじる</button></div>',
      {
        cls: "wide",
        mount(box) {
          UI.drawFaces(box, () => ({ p, team }));
        },
        onAct(act) {
          if (act === "close") return UI.closeModal();
          if (act === "reg") return Su.registerModal(p, () => UI.go(Su.menu()));
          if (act === "unreg") {
            Su.unregister(p.id);
            UI.closeModal();
            UI.toast("チームから外しました");
            return UI.go(Su.menu());
          }
          if (act === "code") {
            const code = Store.encodePlayer(p);
            return UI.modal('<h3 class="modal-title">選手パスワード</h3><p class="note">このパスワードを別の端末で入力すると、同じ選手を読み込めます。</p><textarea class="code" readonly>' + esc(code) + '</textarea><div class="row-btns"><button class="btn" data-act="copy">コピー</button><button class="btn primary" data-act="close">とじる</button></div>', {
              onAct(a2, _x, el) {
                if (a2 === "copy") {
                  const ta = el.closest(".modal-box").querySelector("textarea");
                  const done = () => UI.toast("コピーしました");
                  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => (ta.select(), UI.toast("選択しました。長押しでコピーしてください")));
                  else {
                    ta.select();
                    UI.toast("選択しました。長押しでコピーしてください");
                  }
                } else UI.closeModal();
              },
            });
          }
          if (act === "del")
            return UI.confirm(
              p.full + " を削除します。所属チームからも外れます。",
              () => {
                Su.unregister(p.id);
                Store.data.success.players.splice(i, 1);
                Store.save();
                UI.go(Su.menu());
              },
              { yes: "削除", danger: true }
            );
        },
      }
    );
  };

  Su.importModal = function () {
    UI.modal('<h3 class="modal-title">パスワード入力</h3><textarea class="code" id="pwin" placeholder="PB1-..."></textarea><div class="row-btns"><button class="btn ghost" data-act="close">やめる</button><button class="btn primary" data-act="ok">読み込む</button></div>', {
      onAct(act, _a, el) {
        if (act === "close") return UI.closeModal();
        const v = el.closest(".modal-box").querySelector("#pwin").value;
        const p = Store.decodePlayer(v);
        if (!p) return UI.toast("パスワードが正しくありません");
        p.custom = true;
        Store.data.success.players.push(p);
        Store.save();
        UI.closeModal();
        UI.toast(p.full + " を読み込みました");
        UI.go(Su.menu());
      },
    });
  };

  Su.unregister = function (id) {
    for (const t of Store.teams()) {
      const i = t.players.findIndex((p) => p.id === id);
      if (i < 0) continue;
      t.players.splice(i, 1);
      t.bench = t.bench.filter((x) => x !== id);
      t.rotation = t.rotation.filter((x) => x !== id);
      t.bullpen = t.bullpen.filter((x) => x !== id);
      if (t.closer === id) t.closer = t.bullpen[t.bullpen.length - 1] || null;
      const li = t.lineup.findIndex((e) => e.id === id);
      if (li >= 0) {
        const pos = t.lineup[li].pos;
        const sub = t.bench.map((b) => D.player(t, b)).sort((a, b) => D.batOverall(b) - D.batOverall(a))[0];
        if (sub) {
          t.lineup[li] = { id: sub.id, pos };
          t.bench = t.bench.filter((x) => x !== sub.id);
        }
      }
      t.rotIdx = 0;
    }
    Store.save();
  };

  Su.registerModal = function (p, after) {
    UI.modal('<h3 class="modal-title">登録するチーム</h3>' + Sc.teamPicker("team", null, null) + '<div class="row-btns"><button class="btn ghost" data-act="close">やめる</button></div>', {
      cls: "wide",
      onAct(act, arg) {
        if (act === "close") return UI.closeModal();
        if (act === "team") {
          Su.unregister(p.id);
          const t = Store.team(arg);
          const cp = U.clone(p);
          const used = new Set(t.players.map((x) => x.num));
          if (used.has(cp.num)) {
            for (let n = 0; n < 100; n++)
              if (!used.has(n)) {
                cp.num = n;
                break;
              }
          }
          t.players.push(cp);
          if (cp.pos === "P") {
            if (cp.stamina >= 55) {
              cp.role = "SP";
              t.rotation.unshift(cp.id);
              t.rotIdx = 0;
            } else {
              cp.role = "RP";
              t.bullpen.unshift(cp.id);
            }
          } else {
            // スタメンの同じ守備位置と入れ替え (能力が上なら)
            const li = t.lineup.findIndex((e) => e.pos === cp.pos);
            const cur = li >= 0 ? D.player(t, t.lineup[li].id) : null;
            if (cur && D.batOverall(cp) >= D.batOverall(cur) - 15) {
              t.bench.push(cur.id);
              t.lineup[li] = { id: cp.id, pos: cp.pos };
            } else t.bench.push(cp.id);
          }
          Store.save();
          UI.closeModal();
          UI.toast(cp.full + " が " + t.short + " に入団！");
          if (after) after();
        }
      },
    });
  };

  /* ---------- 画面: 作成 ---------- */
  Su.create = function () {
    const st = { name: U.pick(D.SURNAMES), given: U.pick(D.GIVEN), pos: "SS", throws: "R", bats: "R", team: "t", skin: D.SKINS[0], eyes: "round", hs: U.randi(0, 2), pitch: "SL", num: U.randi(0, 99) };
    const POS_OPTS = [
      ["P", "投手"],
      ["C", "捕手"],
      ["1B", "一塁"],
      ["2B", "二塁"],
      ["3B", "三塁"],
      ["SS", "遊撃"],
      ["LF", "左翼"],
      ["CF", "中堅"],
      ["RF", "右翼"],
    ];
    return {
      html() {
        return (
          UI.header("選手をつくる", "back") +
          '<div class="scr-body"><div class="su-make"><div class="mg-make-pic">' +
          mePic({ face: { skin: st.skin, eyes: st.eyes, hs: st.hs } }, Store.team(st.team), st.eyes === "smile" ? "happy" : "normal", { size: 120 }) +
          '</div><div class="nm-in"><label>苗字<input id="sn" maxlength="6" value="' +
          esc(st.name) +
          '"></label><label>名前<input id="gn" maxlength="6" value="' +
          esc(st.given) +
          '"></label><label>背番号<input id="num" type="number" min="0" max="99" value="' +
          st.num +
          '"></label></div></div>' +
          '<h3 class="lbl">ポジション</h3>' +
          Sc.seg("pos", POS_OPTS, st.pos) +
          '<h3 class="lbl">投げる手</h3>' +
          Sc.seg(
            "throws",
            [
              ["R", "右投げ"],
              ["L", "左投げ"],
            ],
            st.throws
          ) +
          '<h3 class="lbl">打席</h3>' +
          Sc.seg(
            "bats",
            [
              ["R", "右打ち"],
              ["L", "左打ち"],
              ["S", "両打ち"],
            ],
            st.bats
          ) +
          (st.pos === "P"
            ? '<h3 class="lbl">最初の変化球</h3>' +
              Sc.seg(
                "pitch",
                ["SL", "CB", "FK", "SK", "CH", "CT"].map((t) => [t, D.PITCHES[t].name]),
                st.pitch
              )
            : "") +
          '<h3 class="lbl">顔</h3>' +
          Sc.seg(
            "eyes",
            [
              ["round", "まる目"],
              ["big", "ぱっちり"],
              ["sharp", "キリッ"],
              ["smile", "にこにこ"],
              ["line", "細目"],
              ["glasses", "メガネ"],
            ],
            st.eyes
          ) +
          Sc.seg(
            "skin",
            D.SKINS.map((c, i) => [c, ["色白", "標準", "健康的", "日焼け", "明るめ"][i]]),
            st.skin
          ) +
          Sc.seg(
            "hs",
            [
              [0, "前髪ツンツン"],
              [1, "さっぱり短髪"],
              [2, "長めの髪"],
            ],
            st.hs
          ) +
          '<h3 class="lbl">入団するチーム</h3>' +
          Sc.teamPicker("team", st.team, null) +
          '<div class="row-btns stick"><button class="btn red big" data-act="go">入団する！</button></div></div>'
        );
      },
      mount(root) {
        const bind = (id, key) => {
          const el = root.querySelector("#" + id);
          el.addEventListener("input", () => (st[key] = id === "num" ? U.clamp(Number(el.value) || 0, 0, 99) : el.value.trim()));
        };
        bind("sn", "name");
        bind("gn", "given");
        bind("num", "num");
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Su.menu());
        if (act === "go") {
          if (!st.name) return UI.toast("苗字を入力してください");
          const r = Su.newRun(st);
          rollHelpers(r);
          Store.save();
          return Su.story(
            [
              { who: "kanto", text: "お前が新人の" + st.name + "か。ドラフトの順位は関係ない。伸びるかどうかは、ここからのお前しだいだ。" },
              { who: "kanto", text: "7月の一軍昇格テストまでに、オレを納得させる結果を出せ。…楽しみにしているぞ。", face: "serious" },
              { who: "hayase", text: "マネージャーの早瀬です！一緒にがんばろうね、" + st.name + "くん！" },
              { who: "ryuzaki", text: "同期の竜崎だ。一軍の席はひとつ。…ま、お互い全力でいこうぜ。", face: "normal" },
            ],
            () => UI.go(Su.turnScreen())
          );
        }
        if (act in st) st[act] = act === "hs" ? Number(arg) : arg;
        UI.refresh();
      },
    };
  };

  /* ---------- 会話 ---------- */
  // 会話の箱: 左に絵 (表情つき)、右に名前と台詞
  function talkHtml(who, text, ex) {
    const c = who ? CAST[who] : null;
    return (
      '<div class="talkbox' +
      (c ? " mg-talk" : "") +
      '"' +
      (c ? ' style="--bn:' + c.banner + '"' : "") +
      ">" +
      (c ? '<div class="mg-talk-pic">' + castPic(who, ex, { size: 96 }) + "</div>" : "") +
      '<div class="tb-body">' +
      (c ? '<b class="tb-name">' + esc(c.full) + "</b>" : '<b class="tb-name">イベント</b>') +
      '<p class="tb-text">' +
      esc(text) +
      "</p></div></div>"
    );
  }

  Su.story = function (lines, done) {
    let i = 0;
    const r = run();
    const next = () => {
      i++;
      if (i < lines.length) show();
      else {
        UI.closeModal();
        done();
      }
    };
    const show = () => {
      const L = lines[i];
      const ex = MG.faceOf(L.text, L.face);
      // 初めて話す人は紹介カード (最初の台詞はカードのふきだしに出す)
      if (L.who && CAST[L.who] && r && !met(r, L.who)) {
        markMet(r, L.who);
        return Su.introCard(L.who, L.text, ex, next);
      }
      UI.modal(talkHtml(L.who, L.text, ex) + '<div class="row-btns"><button class="btn primary" data-act="next">' + (i < lines.length - 1 ? "▼" : "OK") + "</button></div>", {
        dismiss: false,
        onAct: next,
      });
    };
    show();
  };

  Su.eventModal = function (e, done) {
    const r = run();
    const ex = MG.faceOf(e.text, e.face);
    const open = () =>
      UI.modal(talkHtml(e.who, e.text, ex) + '<div class="col-btns">' + e.choices.map((ch, i) => '<button class="btn" data-act="ch" data-arg="' + i + '">' + esc(ch.t) + "</button>").join("") + "</div>", {
        dismiss: false,
        onAct(act, arg) {
          if (act !== "ch") return;
          const msg = e.choices[Number(arg)].f();
          UI.closeModal();
          if (msg) UI.toast(msg, 2200);
          Store.save();
          done();
        },
      });
    // 初めての人は紹介カード (ふきだしは決め台詞。イベントの台詞は次の箱で選択肢といっしょに出す)
    if (e.who && CAST[e.who] && r && !met(r, e.who)) {
      markMet(r, e.who);
      return Su.introCard(e.who, CAST[e.who].line, CAST[e.who].sig, open);
    }
    open();
  };

  /* ---------- 人物紹介カード ---------- */
  // 金の額縁: 左に大きな絵、右に名前の帯・紹介文、下にふきだし
  Su.introCard = function (who, line, ex, done) {
    const c = CAST[who];
    if (!c) return done && done();
    UI.modal(
      '<div class="mgc" style="--bn:' +
        c.banner +
        '"><button class="mgc-close" data-act="close">閉じる<i>×</i></button>' +
        '<div class="mgc-in"><div class="mgc-pic">' +
        castPic(who, ex || c.sig, { size: 260 }) +
        "</div>" +
        '<div class="mgc-txt"><h3 class="mgc-name' +
        (c.full.length > 6 ? " long" : "") +
        '">' +
        esc(c.full) +
        '</h3><p class="mgc-role">' +
        esc(c.role) +
        '</p><p class="mgc-desc">' +
        c.desc.map(esc).join("<br>") +
        "</p></div>" +
        '<p class="mgc-say">' +
        esc(line) +
        "</p></div></div>",
      {
        cls: "mgc-box",
        dismiss: false,
        onAct(act) {
          if (act !== "close") return;
          UI.closeModal();
          if (done) done();
        },
      }
    );
  };

  // 人物の一覧 (会った人だけ紹介カードを開ける)
  Su.people = function () {
    const r = run();
    const rows = CAST_ORDER.map((k) => {
      const c = CAST[k];
      const known = met(r, k);
      const v = k === "kanto" ? Math.min(100, Math.max(0, r.eval)) : Math.min(100, r.rel[k] || 0);
      return (
        '<button class="mgp-row' +
        (known ? "" : " unknown") +
        '" data-act="who" data-arg="' +
        k +
        '"' +
        (known ? "" : " disabled") +
        ' style="--bn:' +
        c.banner +
        '"><span class="mgp-pic">' +
        castIcon(k, known ? c.sig : "normal", !known) +
        '</span><span class="mgp-txt"><b>' +
        (known ? esc(c.full) : "？？？") +
        "</b><small>" +
        (known ? esc(c.role) : "まだ出会っていない") +
        '</small></span><span class="mgp-rel"><small>' +
        (k === "kanto" ? "評価" : "仲よし") +
        '</small><em><b style="width:' +
        v +
        '%"></b></em></span></button>'
      );
    }).join("");
    UI.modal('<h3 class="modal-title">人物</h3><div class="mgp">' + rows + '</div><div class="row-btns"><button class="btn primary" data-act="close">とじる</button></div>', {
      onAct(act, arg) {
        if (act === "who") return Su.introCard(arg, CAST[arg].line, CAST[arg].sig, () => Su.people());
        if (act === "close") UI.closeModal();
      },
    });
  };

  /* ---------- 画面: 週の行動 ---------- */
  Su.turnScreen = function () {
    const r = run();
    if (!r) return Su.menu();
    return {
      cls: "success",
      html() {
        const p = r.player;
        const prs = isP(r) ? PR_PIT : PR_BAT;
        const game = GAMES[r.turn];
        const moodCls = ["m0", "m1", "m2", "m3", "m4"][r.mood];
        const hpCol = r.hp > 60 ? "#3ddc84" : r.hp > 35 ? "#ffd23f" : "#ff4d4d";
        const expRow = Object.keys(EXP)
          .filter((k) => isP(r) || k !== "brk")
          .map((k) => '<span class="ex"><i>' + EXP[k] + "</i><b>" + r.exp[k] + "</b></span>")
          .join("");
        const btn = (pr) => {
          const g = practiceGain(r, pr);
          const hs = r.helpers[pr.k] || [];
          const lv = Math.floor(r.plv[pr.k] || 1);
          return (
            '<button class="prac" data-act="pr" data-arg="' +
            pr.k +
            '"' +
            (r.injured ? " disabled" : "") +
            '><b>' +
            esc(pr.name) +
            '<small>Lv' +
            lv +
            '</small></b><span class="pg">' +
            gainText(g) +
            '</span><span class="ph">体力-' +
            pr.hp +
            "</span>" +
            (hs.length ? '<span class="helpers">' + hs.map((h) => '<i class="mg-i" title="' + esc(CAST[h].name) + '">' + castIcon(h, CAST[h].sig, !met(r, h)) + "</i>").join("") + "</span>" : "") +
            "</button>"
          );
        };
        return (
          '<header class="scr-head su-head"><button class="back" data-act="menu" aria-label="中断">‹</button><h2>' +
          dateText(r.turn) +
          '</h2><span class="su-left">残り' +
          (TOTAL - r.turn) +
          "週</span></header>" +
          '<div class="scr-body"><div class="su-status"><div class="mg-me-pic">' +
          mePic(p, Store.team(r.team), moodFace(r), { size: 96 }) +
          '</div><div class="su-st"><b class="su-name">' +
          esc(p.full) +
          ' <small>' +
          esc(D.POS_FULL[p.pos]) +
          '</small></b><div class="bar"><span>体力</span><i><em style="width:' +
          r.hp +
          "%;background:" +
          hpCol +
          '"></em></i><b>' +
          r.hp +
          '</b></div><div class="bar"><span>評価</span><i><em style="width:' +
          Math.min(100, r.eval) +
          '%;background:#7fb4ff"></em></i><b>' +
          r.eval +
          '</b></div><span class="mood ' +
          moodCls +
          '">やる気：' +
          MOODS[r.mood] +
          "</span></div></div>" +
          '<div class="exps">' +
          expRow +
          "</div>" +
          (r.injured ? '<p class="warn">ケガで練習できない（あと' + r.injured + "週）。休んで治そう。</p>" : "") +
          (game ? '<div class="su-game"><b>今週は「' + esc(game.name) + '」！</b><small>' + (isP(r) ? game.bf + "人の打者と対戦" : game.pa + "打席に立つ") + '</small><button class="btn red" data-act="game">試合へ</button></div>' : '<div class="pracs">' + prs.map(btn).join("") + "</div>") +
          (game
            ? ""
            : '<div class="row-btns"><button class="btn" data-act="pr" data-arg="rest">休む</button><button class="btn" data-act="pr" data-arg="play"' +
              (r.injured ? " disabled" : "") +
              ">遊ぶ</button></div>") +
          '<div class="row-btns"><button class="btn primary" data-act="up">能力アップ</button><button class="btn" data-act="status">能力を見る</button></div>' +
          // 仲よしの欄を押すと人物の一覧 (ボタンを横に 3 つ並べると狭い画面で文字が折り返すので)
          '<button class="rels" data-act="people"><span class="rels-h">人物・仲よし<i>›</i></span>' +
          ["goda", "hayase", "inukai", "ryuzaki"]
            .map((k) => '<span class="rel"><i class="mg-i">' + castIcon(k, CAST[k].sig, !met(r, k)) + "</i>" + esc(CAST[k].name) + '<em><b style="width:' + Math.min(100, r.rel[k]) + '%"></b></em></span>')
            .join("") +
          "</button></div>"
        );
      },
      onAct(act, arg) {
        if (act === "menu") {
          Store.save();
          return UI.go(Su.menu());
        }
        if (act === "up") return UI.go(Su.spend(() => UI.go(Su.turnScreen())));
        if (act === "people") return Su.people();
        if (act === "status") return UI.modal(UI.playerCard(r.player, Store.team(r.team)) + '<div class="row-btns"><button class="btn primary" data-act="x">とじる</button></div>', { cls: "wide", mount: (b) => UI.drawFaces(b, () => ({ p: r.player, team: Store.team(r.team) })), onAct: () => UI.closeModal() });
        if (act === "game") return Su.playGame();
        if (act === "pr") {
          if (r.injured && arg !== "rest") return;
          const msgs = Su.doPractice(r, arg);
          A.select();
          Su.endTurn(msgs);
        }
      },
    };
  };

  Su.endTurn = function (msgs) {
    const r = run();
    if (r.injured > 0) r.injured--;
    r.turn++;
    rollHelpers(r);
    Store.save();
    const after = () => {
      if (r.turn >= TOTAL) return Su.ending();
      UI.go(Su.turnScreen());
    };
    const evs = () => {
      const b = bondEvent(r);
      if (b) return Su.eventModal(b, after);
      if (Math.random() < 0.38) return Su.eventModal(U.pick(RANDOM_EVENTS)(r), after);
      after();
    };
    if (msgs && msgs.length) {
      UI.modal('<p class="modal-text">' + msgs.map(esc).join("<br>") + '</p><div class="row-btns"><button class="btn primary" data-act="ok">OK</button></div>', {
        dismiss: false,
        onAct() {
          UI.closeModal();
          evs();
        },
      });
    } else evs();
  };

  /* ---------- 試合イベント ---------- */
  Su.playGame = function () {
    const r = run();
    const gdef = GAMES[r.turn];
    const myT = U.clone(Store.team(r.team));
    const others = Store.teams().filter((t) => t.id !== r.team);
    const oppT = U.clone(gdef.opp === "same" ? Object.assign({}, Store.team(r.team), { id: "red", short: "紅組", name: "紅組", main: "#c0392b", cap: "#7b1d14" }) : U.pick(others));
    if (gdef.opp === "same") {
      oppT.players = oppT.players.map((p) => Object.assign({}, p, { id: "r_" + p.id }));
      oppT.lineup = oppT.lineup.map((e) => ({ id: "r_" + e.id, pos: e.pos }));
      oppT.rotation = oppT.rotation.map((id) => "r_" + id);
      oppT.bullpen = oppT.bullpen.map((id) => "r_" + id);
      oppT.bench = oppT.bench.map((id) => "r_" + id);
      oppT.closer = oppT.closer ? "r_" + oppT.closer : null;
    }
    const me = U.clone(r.player);
    me.id = "me_" + me.id;
    myT.players.push(me);
    const tally = { pa: 0, h: 0, hr: 0, rbi: 0, k: 0, bb: 0, outs: 0, hits: 0, runs: 0 };
    let game;
    if (isP(r)) {
      myT.rotation.unshift(me.id);
      myT.rotIdx = 0;
      game = new PB.Game({ away: oppT, home: myT, innings: 99, user: "home", level: Store.settings().level, starters: { home: me.id } });
      game.inning = 5;
    } else {
      // 4番に入れる
      const pos = me.pos;
      const li = myT.lineup.findIndex((e) => e.pos === pos);
      if (li >= 0) myT.lineup.splice(li, 1);
      myT.lineup.splice(3, 0, { id: me.id, pos });
      if (myT.lineup.length > 9) myT.lineup.length = 9;
      game = new PB.Game({ away: myT, home: oppT, innings: 99, user: "away", level: Store.settings().level });
    }
    const setScene = (g) => {
      if (isP(r)) {
        if (g.outs >= 3 || !g.top) {
          g.top = true;
          g.outs = 0;
          g.bases = [null, null, null, null];
        }
        g.inning = Math.max(g.inning, 5);
        g.pstate.home.stamina = g.pstate.home.max;
      } else {
        g.top = true;
        g.inning = 7 + Math.floor(tally.pa / 2);
        g.outs = U.randi(0, 1);
        const runners = g.order.away.filter((e) => e.id !== me.id).map((e) => g.P(e.id));
        g.bases = [null, Math.random() < 0.5 ? runners[0] : null, Math.random() < 0.6 ? runners[1] : null, Math.random() < 0.3 ? runners[2] : null];
        g.bi.away = g.order.away.findIndex((e) => e.id === me.id);
        g.newPA();
      }
      g.halfChangedReset = true;
    };
    setScene(game);
    const maxPA = isP(r) ? gdef.bf : gdef.pa;
    UI.hideScreen();
    PB.main.startMatch({
      game,
      mode: "mini",
      night: false,
      mini: {
        side: isP(r) ? "pitch" : "bat",
        maxPA,
        onPA: (res, g, ev) => {
          tally.pa++;
          const t = ev ? ev.type : "out";
          if (isP(r)) {
            if (t === "K") tally.k++;
            else if (t === "BB") tally.bb++;
            else if (["H1", "H2", "H3", "HR", "IPHR"].indexOf(t) >= 0) tally.hits++;
            else tally.outs++;
          } else {
            if (t === "K") tally.k++;
            else if (t === "BB") tally.bb++;
            else if (["H1", "H2", "H3", "HR", "IPHR"].indexOf(t) >= 0) {
              tally.h++;
              if (t === "HR" || t === "IPHR") tally.hr++;
            }
            if (res && ev && ev.type !== "K" && ev.type !== "BB") tally.rbi += res.runs || 0;
          }
          if (tally.pa < maxPA) setScene(g);
        },
      },
      onEnd: () => {
        PB.main.stopMatch();
        Su.gameResult(gdef, tally);
      },
      onQuit: () => UI.go(Su.turnScreen()),
    });
  };

  Su.gameResult = function (gdef, t) {
    const r = run();
    let score;
    let lines;
    if (isP(r)) {
      score = t.k * 8 + t.outs * 5 - t.hits * 5 - t.bb * 4;
      lines = [t.pa + "人と対戦", t.k + "奪三振", "被安打 " + t.hits, "四死球 " + t.bb];
      addExp(r, { brk: 10 + t.k * 6, tec: 8 + t.outs * 3, men: 10, str: 6 });
    } else {
      score = t.h * 12 + t.hr * 14 + t.rbi * 5 + t.bb * 4 - t.k * 3;
      lines = [t.pa + "打席 " + t.h + "安打", t.hr + "本塁打", t.rbi + "打点", "三振 " + t.k];
      addExp(r, { tec: 10 + t.h * 8, str: 8 + t.hr * 14, men: 10, agi: 5 });
    }
    if (gdef.final) score *= 1.5;
    r.eval += Math.round(score);
    r.mood = U.clamp(r.mood + (score > 15 ? 1 : score < 0 ? -1 : 0), 0, 4);
    r.gameLog.push({ name: gdef.name, score: Math.round(score) });
    Store.save();
    const good = score > 15;
    UI.go({
      cls: "result",
      html() {
        return (
          '<div class="scr-body res-body"><div class="res-head ' +
          (good ? "win" : score < 0 ? "lose" : "") +
          '"><p class="walkoff">' +
          esc(gdef.name) +
          "</p><h2>" +
          (good ? "大活躍！" : score >= 0 ? "まずまず" : "悔しい結果…") +
          '</h2></div><ul class="glines">' +
          lines.map((l) => "<li>" + esc(l) + "</li>").join("") +
          '</ul><p class="wls">監督の評価 <b>' +
          (score >= 0 ? "+" : "") +
          Math.round(score) +
          '</b></p><div class="row-btns stick"><button class="btn primary" data-act="ok">次へ</button></div></div>'
        );
      },
      onAct() {
        Su.endTurn([]);
      },
    });
  };

  /* ---------- 能力アップ ---------- */
  Su.spend = function (back) {
    const r = run();
    return {
      cls: "success",
      html() {
        const p = r.player;
        const ups = isP(r) ? PIT_UP : BAT_UP;
        const expRow = Object.keys(EXP)
          .filter((k) => isP(r) || k !== "brk")
          .map((k) => '<span class="ex"><i>' + EXP[k] + "</i><b>" + r.exp[k] + "</b></span>")
          .join("");
        let rows = ups
          .map((d) => {
            const c = upCost(r, d);
            const v = p[d.k];
            const maxed = v >= (d.max || 100);
            const rk = d.k === "velo" ? null : D.rank(v);
            return (
              '<div class="uprow"><span class="ul">' +
              esc(d.name) +
              "</span>" +
              (rk ? '<b class="ab-r" style="--rk:' + rk.color + '">' + rk.r + "</b><span class=\"uv\">" + v + "</span>" : '<span class="uv big">' + v + "km/h</span>") +
              '<span class="uc">' +
              costText(c) +
              '</span><button class="btn sm" data-act="up" data-arg="' +
              d.k +
              '"' +
              (maxed || !canPay(r, c) ? " disabled" : "") +
              ">＋</button></div>"
            );
          })
          .join("");
        if (!isP(r)) {
          const c = trajCost(r);
          rows += '<div class="uprow"><span class="ul">弾道</span><span class="uv big">' + p.traj + '</span><span class="uc">' + costText(c) + '</span><button class="btn sm" data-act="traj"' + (p.traj >= 4 || !canPay(r, c) ? " disabled" : "") + ">＋</button></div>";
        } else {
          for (const pt of p.pitches) {
            const c = pitchCost(pt.lv);
            rows += '<div class="uprow"><span class="ul">' + esc(D.PITCHES[pt.t].name) + '</span><span class="uv big">Lv' + pt.lv + '</span><span class="uc">' + costText(c) + '</span><button class="btn sm" data-act="plv" data-arg="' + pt.t + '"' + (pt.lv >= 7 || !canPay(r, c) ? " disabled" : "") + ">＋</button></div>";
          }
          if (p.pitches.length < 4) {
            const c = newPitchCost(r);
            const cand = ["SL", "CB", "FK", "SK", "CH", "CT", "SF", "SH", "VS", "HS", "TS", "SC"].filter((t) => !p.pitches.find((x) => x.t === t));
            rows += '<div class="uprow wrap"><span class="ul">新しい変化球</span><span class="uc">' + costText(c) + '</span><div class="newp">' + cand.map((t) => '<button class="chip" data-act="newp" data-arg="' + t + '"' + (canPay(r, c) ? "" : " disabled") + "><i>" + D.pitchArrow(t, p.throws) + "</i>" + esc(D.PITCHES[t].short) + "</button>").join("") + "</div></div>";
          }
        }
        const shop = (isP(r) ? SKILL_SHOP_PIT : SKILL_SHOP_BAT).filter((s) => p.skills.indexOf(s) < 0);
        const sc = skillCost(r);
        return (
          UI.header("能力アップ", "back") +
          '<div class="scr-body"><div class="exps sticky">' +
          expRow +
          "</div>" +
          rows +
          '<h3 class="lbl">特殊能力（' +
          costText(sc) +
          '）</h3><div class="skills shop">' +
          shop.map((s) => '<button class="skill good" data-act="skill" data-arg="' + s + '"' + (canPay(r, sc) ? "" : " disabled") + ' title="' + esc(D.SKILLS[s].desc) + '">' + esc(D.SKILLS[s].name) + "</button>").join("") +
          '</div><p class="note">習得済み：' +
          (p.skills.map((s) => D.SKILLS[s].name).join("、") || "なし") +
          "</p></div>"
        );
      },
      onAct(act, arg) {
        const p = r.player;
        if (act === "back") return back();
        if (act === "up") {
          const d = (isP(r) ? PIT_UP : BAT_UP).find((x) => x.k === arg);
          const c = upCost(r, d);
          if (!canPay(r, c)) return;
          pay(r, c);
          p[arg] = Math.min(d.max || 100, p[arg] + (arg === "velo" ? 1 : 2));
        } else if (act === "traj") {
          const c = trajCost(r);
          if (!canPay(r, c) || p.traj >= 4) return;
          pay(r, c);
          p.traj++;
        } else if (act === "plv") {
          const pt = p.pitches.find((x) => x.t === arg);
          const c = pitchCost(pt.lv);
          if (!canPay(r, c) || pt.lv >= 7) return;
          pay(r, c);
          pt.lv++;
        } else if (act === "newp") {
          const c = newPitchCost(r);
          if (!canPay(r, c)) return;
          pay(r, c);
          p.pitches.push({ t: arg, lv: 1 });
        } else if (act === "skill") {
          const c = skillCost(r);
          if (!canPay(r, c)) return;
          pay(r, c);
          p.skills.push(arg);
          UI.toast("「" + D.SKILLS[arg].name + "」を習得！");
        }
        A.select();
        Store.save();
        UI.refresh();
      },
    };
  };

  /* ---------- エンディング ---------- */
  Su.ending = function () {
    const r = run();
    const e = r.eval;
    let lines;
    let bonus;
    if (e >= 90) {
      bonus = 120;
      lines = [
        { who: "kanto", text: "……見事だ。文句なしの一軍昇格だ。開幕から、お前を使う。", face: "happy" },
        { who: "hayase", text: "やったね！ずっと信じてたよ！" },
        { who: "ryuzaki", text: "…やるじゃないか。今回は譲ってやる。だが次は負けねえぞ。", face: "normal" },
      ];
    } else if (e >= 50) {
      bonus = 70;
      lines = [
        { who: "kanto", text: "まだ荒削りだが…一軍に上げよう。ここからが本番だぞ。", face: "normal" },
        { who: "hayase", text: "一軍昇格おめでとう！これからが本番だね！" },
      ];
    } else {
      bonus = 30;
      lines = [
        { who: "kanto", text: "今のお前に一軍はまだ早い。だが、伸びしろはある。二軍でいっしょに鍛え直そう。", face: "serious" },
        { who: "goda", text: "落ち込むな！オレだって二軍からはい上がったんだ！", face: "happy" },
      ];
    }
    addExp(r, { str: bonus, agi: bonus, tec: bonus, brk: isP(r) ? bonus : 0, men: bonus });
    Store.save();
    Su.story(lines, () => {
      UI.toast("ボーナス経験点 +" + bonus + "！ 最後の能力アップをしよう", 2600);
      UI.go(
        Su.spend(() =>
          UI.confirm(
            "育成を完了して選手を登録しますか？（あとから能力は上げられません）",
            () => Su.complete(),
            { yes: "完成！" }
          )
        )
      );
    });
  };

  Su.complete = function () {
    const r = run();
    const p = U.clone(r.player);
    if (p.pos === "P") p.role = p.stamina >= 55 ? "SP" : "RP";
    Store.data.success.players.push(p);
    Store.data.success.run = null;
    Store.save();
    A.victory();
    UI.go({
      cls: "result",
      html() {
        return '<div class="scr-body res-body"><div class="res-head win"><p class="walkoff">サクセス完了</p><h2>選手完成！</h2></div><div class="mg-done-pic">' + mePic(p, Store.team(r.team), "happy", { size: 160 }) + "</div>" + UI.playerCard(p, Store.team(r.team)) + '<div class="row-btns stick"><button class="btn red" data-act="reg">チームに登録</button><button class="btn primary" data-act="done">あとで</button></div></div>';
      },
      mount(root) {
        UI.drawFaces(root, () => ({ p, team: Store.team(r.team) }));
      },
      onAct(act) {
        if (act === "reg") Su.registerModal(p, () => UI.go(Su.menu()));
        else UI.go(Su.menu());
      },
    });
  };

  Su.CAST = CAST;
  PB.Success = Su;
})((window.PB = window.PB || {}));
