/* 熱闘！ポケットベースボール — テレビ中継風のテロップ
   カウント表示 (SBO)・打者紹介・球速・得点・ホームラン・今日の結果 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const esc = U.esc;

  const PROGRAM = "POCKET BASEBALL";

  /* ---------- 小物 ---------- */
  function teamOf(t) {
    const def = D.teamDef ? D.teamDef(t.id) : null;
    return def ? Object.assign({}, def, t) : t;
  }
  function abbr(t) {
    return t.abbr || String(t.short || t.name || "?").slice(0, 1);
  }
  function logoImg(t, cls) {
    const tt = teamOf(t);
    if (tt.logo) return '<img class="' + cls + '" src="' + tt.logo + '" alt="" draggable="false">';
    return '<span class="' + cls + ' tv-txtlogo" style="background:' + (tt.main || "#333") + ";color:" + (tt.sub || "#fff") + '">' + esc(tt.mark || abbr(tt)) + "</span>";
  }
  function hexRgb(h) {
    const s = String(h || "#444").replace("#", "");
    const v = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
    const n = parseInt(v, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, k) {
    const c = hexRgb(h).map((x) => Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k)));
    return "rgb(" + c.join(",") + ")";
  }
  // 選手名を「姓　名」で (外国人選手は「名・姓」)
  function fullName(p) {
    if (!p.given) return p.name;
    return p.foreign ? p.given + "・" + p.name : p.name + "　" + p.given;
  }
  function avg3(v) {
    if (v == null || isNaN(v)) return "----";
    return v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, "");
  }
  function innLong(inning, top) {
    return inning + "回" + (top ? "オモテ" : "ウラ");
  }
  // 金属調の数字 (金・銀)
  function mnum(n, metal) {
    return '<b class="mnum ' + metal + '" data-t="' + n + '">' + n + "</b>";
  }
  // 場内アナウンスの守備位置
  const POS_PA = { P: "ピッチャー", C: "キャッチャー", "1B": "ファースト", "2B": "セカンド", "3B": "サード", SS: "ショート", LF: "レフト", CF: "センター", RF: "ライト", DH: "指名打者", PH: "代打" };

  /* ---------- 演出用の選手カード ---------- */
  // 描けた選手の画像を覚えておく (同じ選手は次から待たずに出せる)
  const pcache = new Map();
  function pkey(p, team, o) {
    const v3 = PB.View3D && PB.View3D.active;
    return p.id + ":" + team.id + ":" + (o.kind || (p.pos === "P" ? "pit" : "bat")) + ":" + (o.home === false ? "a" : "h") + ":" + (v3 ? "3" : "2");
  }
  // 2 頭身のキャラ (3D の選手をまだ描いていないとき・2D 表示のとき)
  function chibi(p, team) {
    if (!PB.Chara) return null;
    const cv = document.createElement("canvas");
    cv.width = 300;
    cv.height = 400;
    PB.Chara.draw(cv.getContext("2d"), 150, 384, 150, { team, face: p.face, view: "front", pose: p.pos === "P" ? "throw" : "cheer", t: 0.6, num: p.num, mark: team.mark, noShadow: true });
    return cv;
  }
  // カードの <canvas> と、選手の画像が載ったら解決する ready を返す。
  // o: { w, mini, home, kind, fetch: 3D の選手を新しく描かせてよい (false なら写真・描いた画像・2 頭身だけ) }
  function cardFor(p, team, o) {
    const C = PB.Cards;
    const cw = Math.round(o.w || 120);
    const ch = Math.round(cw * (o.mini ? 1.25 : 1.333));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement("canvas");
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
    cv.style.width = cw + "px";
    cv.style.height = ch + "px";
    cv.className = "pbcard tvcard" + (o.mini ? " mini" : "");
    if (!C) return { cv, ready: Promise.resolve() };
    const tt = teamOf(team);
    const key = pkey(p, tt, o);
    let img = pcache.get(key) || null;
    const draw = () => C.draw(cv, p, tt, img, o).catch(() => {});
    let ready;
    if (img) ready = draw();
    else {
      const v3 = PB.View3D && PB.View3D.active;
      const photo = C.photoOf(p, tt);
      const real = photo || !v3 || o.fetch;
      const src = real ? C.portraitOf(p, tt, o) : Promise.resolve(chibi(p, tt));
      draw();
      ready = src.then(
        (im) => {
          if (!im) return;
          img = im;
          if (real) {
            pcache.set(key, im);
            while (pcache.size > 60) pcache.delete(pcache.keys().next().value);
          }
          return draw();
        },
        () => {}
      );
    }
    // カードの書体 (その文字の分) を読み込んでから描き直す
    const F = document.fonts;
    if (F && F.load) {
      const text = (p.full || p.name) + (p.given || "") + (tt.short || "") + "総合2004#" + (D.POS_JP[o.pos || p.pos] || "") + (p.num != null ? p.num : "");
      Promise.all(['900 20px "M PLUS 1p"', '400 20px "Archivo Black"'].map((f) => F.load(f, text))).then(draw, () => {});
    }
    return { cv, ready };
  }

  /* ---------- 実況・解説の言い回し (同じ文が続かないように選ぶ) ---------- */
  const PHR = {
    strike: ["ストライク！", "見逃してストライク", "外角いっぱい、ストライク！", "ズバッと決まった！", "いいコースに来ました", "内角を突いてストライク", "低めいっぱい、ストライク"],
    strikeFirst: ["{pit}、まずはストライク先行", "初球、ストライク！", "初球から攻めてきました"],
    swing: ["空振り！", "バットが空を切った！", "{pit}、空振りを奪う！", "タイミングが合わない！", "振らされた！"],
    twoK: ["追い込みました！", "{pit}、追い込んだ！", "ツーストライク！"],
    ball: ["ボール", "外れてボール", "低めに外れました", "ボール、よく見ました", "高めに浮いた、ボール", "{bat}、見極めた"],
    full: ["フルカウント！勝負の一球", "スリーボール・ツーストライク！"],
    foul: ["ファウル", "ファウルボール", "{bat}、粘ります", "カットした！", "後ろへファウル"],
    kSwing: ["空振り三振！", "{pit}、空振り三振！", "三振！バットは空を切った！", "最後は空振り！三振！"],
    kLook: ["見逃し三振！", "手が出ない！見逃し三振！", "{pit}、最後は見逃し三振！", "ズバッと決まった！見逃し三振！"],
    bb: ["フォアボール！", "歩かせました", "四球で出塁"],
    hbp: ["デッドボール！", "当ててしまった！", "これは痛い、デッドボール"],
    hitStrong: ["打ったー！！", "捉えたー！", "強烈な当たり！", "痛烈！"],
    hitFly: ["打ち上げた！", "高く上がった！", "上がった！"],
    hitGround: ["叩きつけた！", "転がした！", "ゴロになった！"],
    hit: ["打った！", "弾き返した！", "合わせた！"],
    hrGo: ["打ったー！大きい！", "いい角度で上がった！", "これは大きいぞ！", "打ったー！伸びる！"],
    hrMaybe: ["入るか！？", "伸びる！伸びる！", "どうだ！？", "まだ伸びる！"],
    hrIn: ["入ったー！ホームラン！", "スタンドイン！ホームラン！", "文句なし！ホームラン！", "{bat}、第{n}号ホームラン！"],
    fine: ["好捕！", "ナイスキャッチ！", "よく捕った！", "うまい！捕った！"],
    dive: ["ダイビングキャッチ！！", "飛びついたー！捕った！"],
    jump: ["ジャンピングキャッチ！", "跳んだー！捕った！"],
    wall: ["フェンス際、捕った！", "フェンスぎりぎり、よく捕った！"],
    dp: ["ゲッツー！", "併殺完成！", "ダブルプレー！"],
    score: ["{runner}、ホームイン！", "{runner}がかえってくる！", "{runner}、生還！"],
    chance: ["チャンスです！", "得点圏にランナー！", "さあ、チャンス！"],
    steal: ["ランナー走った！", "スタートを切った！"],
    pchange: ["ピッチャー交代、{p}。", "ここでピッチャー交代、{p}がマウンドへ"],
  };
  const KAI = {
    k: ["{pit}の決め球ですね", "今のは手が出ませんね", "いいボールでした", "バッテリーの勝ちですね"],
    hr: ["あれを打たれては仕方ない", "完璧に捉えましたね", "甘いボールを逃しませんでした", "風にも乗りましたね"],
    fine: ["今のは大きなプレーですよ", "守備で流れを変えましたね", "よく追いつきました"],
    dp: ["ピッチャー助かりましたね", "最高の形のゲッツーです"],
    bb: ["四球は痛いですね", "ここで歩かせたくはなかった"],
    hit: ["うまく合わせましたね", "コースに逆らわずに打ちました", "しぶとく転がしましたね"],
    score: ["大きな1点ですね", "これで流れが変わりますよ"],
    chance: ["走者が溜まってきましたね", "ここは一本ほしいところです"],
  };
  const recent = [];
  function pick(list, vars) {
    const okv = (s) => !/\{n\}/.test(s) || (vars && vars.n);
    let c = list.filter((s) => recent.indexOf(s) < 0 && okv(s));
    if (!c.length) c = list.filter(okv);
    if (!c.length) c = list;
    const s = c[Math.floor(Math.random() * c.length)];
    recent.push(s);
    if (recent.length > 14) recent.shift();
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ""));
  }
  // ヒーローインタビュー (質問と答え)
  const HERO = {
    walkoff: [
      ["サヨナラの場面、どんな気持ちで打席へ？", "絶対に自分で決めてやろうと思っていました！"],
      ["打った瞬間はいかがでしたか？", "抜けてくれ！と思いながら走りました！"],
    ],
    hr: [
      ["今日の一発、振り返っていかがですか？", "打った瞬間、いったと思いました！"],
      ["あの打席、狙い球は？", "まっすぐ一本に絞っていました！"],
    ],
    hit: [
      ["今日は{h}安打の大活躍でした", "チームの勝ちに貢献できてうれしいです！"],
      ["チャンスでの一本でした", "後ろにつなぐ気持ちで打ちました！"],
    ],
    pit: [
      ["今日のピッチング、振り返っていかがですか？", "キャッチャーのリードを信じて投げました！"],
      ["{k}個の三振を奪いました", "ストレートが走っていたので、強気に攻めました！"],
    ],
    save: [["最後を締めました", "いつも通り、自分のボールを投げるだけでした！"]],
  };

  /* ---------- テレビ中継グラフィック ---------- */
  class TV {
    constructor(match) {
      this.m = match;
      this.g = match.g;
      this.l3q = [];
      this.timers = {};
      this.scoreSeen = 0;
      this.bugSeen = 0; // カウント表示に反映した得点の場面の数 (中央の得点パネルより先に数字を変えない)
      this.spShown = {};
    }

    html() {
      return (
        '<div class="tv-bug">' +
        '<div class="tvb-sbo">' +
        '<svg class="tvb-dia" viewBox="0 0 46 46" aria-hidden="true"><path d="M23 4 L42 23 L23 42 L4 23 Z"/></svg>' +
        '<i class="tvb-base b2"></i><i class="tvb-base b3"></i><i class="tvb-base b1"></i>' +
        '<div class="tvb-l s"><b>S</b><i></i><i></i></div>' +
        '<div class="tvb-l b"><b>B</b><i></i><i></i><i></i></div>' +
        '<div class="tvb-l o"><b>O</b><i></i><i></i></div>' +
        "</div>" +
        '<div class="tvb-sc"><div class="tvb-inn"></div>' +
        '<div class="tvb-t" data-side="away"><span class="tvb-ab"></span><b></b></div>' +
        '<div class="tvb-t" data-side="home"><span class="tvb-ab"></span><b></b></div>' +
        "</div></div>" +
        '<div class="tv-spd"></div>' +
        '<div class="tv-mu"><div class="mu-row mu-p"></div><div class="mu-stam"><i></i></div><div class="mu-row mu-b"></div></div>' +
        '<div class="tv-l3"></div>' +
        '<div class="tv-center"></div>' +
        '<div class="tv-hr"></div>' +
        '<div class="tv-tick"></div>' +
        '<div class="tv-dist"></div>' +
        '<div class="tv-k"></div>' +
        '<div class="tv-pa"></div>' +
        '<div class="tv-card"></div>' +
        '<div class="tv-call"></div>' +
        '<div class="tv-l7"></div>' +
        '<div class="tv-wl"></div>' +
        '<div class="tv-hero"></div>' +
        '<div class="tv-lu"></div>'
      );
    }

    mount(hud) {
      this.hud = hud;
      const q = (s) => hud.querySelector(s);
      this.el = {
        bug: q(".tv-bug"),
        inn: q(".tvb-inn"),
        spd: q(".tv-spd"),
        mu: q(".tv-mu"),
        muP: q(".mu-p"),
        muB: q(".mu-b"),
        stam: q(".mu-stam i"),
        l3: q(".tv-l3"),
        center: q(".tv-center"),
        hr: q(".tv-hr"),
        tick: q(".tv-tick"),
        dist: q(".tv-dist"),
        k: q(".tv-k"),
        pa: q(".tv-pa"),
        card: q(".tv-card"),
        call: q(".tv-call"),
        l7: q(".tv-l7"),
        wl: q(".tv-wl"),
        hero: q(".tv-hero"),
        lu: q(".tv-lu"),
      };
    }

    later(key, ms, fn) {
      clearTimeout(this.timers[key]);
      this.timers[key] = setTimeout(fn, ms);
    }

    destroy() {
      for (const k in this.timers) clearTimeout(this.timers[k]);
      this.timers = {};
      this.l3q = [];
    }

    // 表示 → 一定時間後に退場アニメ
    flash(el, html, ms, key, cls) {
      clearTimeout(this.timers[key + "x"]);
      el.innerHTML = html;
      el.className = el.className.split(" ")[0] + (cls ? " " + cls : "");
      void el.offsetWidth;
      el.classList.add("show");
      this.later(key, ms, () => {
        el.classList.remove("show");
        el.classList.add("out");
        this.later(key + "x", 450, () => {
          el.classList.remove("out");
          el.innerHTML = "";
        });
      });
    }
    hide(key) {
      const el = this.el[key];
      if (!el) return;
      clearTimeout(this.timers[key]);
      clearTimeout(this.timers[key + "x"]);
      clearTimeout(this.timers[key + "w"]);
      el.classList.remove("show", "out", "leave");
      el.innerHTML = "";
      if (key === "call") clearTimeout(this.timers.callq);
      if (key === "card") this.cardTok = (this.cardTok || 0) + 1;
      if (key === "l3") {
        this.l3q = [];
        this.l3busy = false;
      }
    }

    /* ---------- カウント表示 (左上) ---------- */
    update() {
      const g = this.g;
      const m = this.m;
      const el = this.el;
      if (!el) return;
      const bug = el.bug;
      const lamp = (cls, n) => bug.querySelectorAll(".tvb-l." + cls + " i").forEach((e, i) => e.classList.toggle("on", i < n));
      lamp("s", g.strikes);
      lamp("b", g.balls);
      lamp("o", g.outs);
      ["b1", "b2", "b3"].forEach((k, i) => bug.querySelector(".tvb-base." + k).classList.toggle("on", !!g.bases[i + 1]));
      if (m.derby) {
        el.inn.textContent = "HR競争";
        const rows = bug.querySelectorAll(".tvb-t");
        rows[0].querySelector(".tvb-ab").textContent = "本";
        rows[0].querySelector("b").textContent = m.derby.hr;
        rows[1].querySelector(".tvb-ab").textContent = "残";
        rows[1].querySelector("b").textContent = Math.max(0, m.derby.maxOuts - m.derby.outs);
      } else {
        el.inn.textContent = g.inning + (g.top ? "表" : "裏");
        // 点が入った場面は、中央の得点パネルが数字を変えるまでカウント表示の数字を待たせる
        const hold = m.mode === "game" && g.scoreLog.length > this.bugSeen && !g.over;
        for (const side of ["away", "home"]) {
          const t = teamOf(g.teams[side]);
          const row = bug.querySelector('.tvb-t[data-side="' + side + '"]');
          row.classList.toggle("atbat", g.battingSide() === side);
          row.style.setProperty("--tc", t.main || "#c00");
          row.querySelector(".tvb-ab").textContent = abbr(t);
          const b = row.querySelector("b");
          const v = String(g.score[side]);
          if (b.textContent !== v && !(hold && b.textContent !== "")) {
            b.textContent = v;
            b.classList.remove("pop");
            void b.offsetWidth;
            b.classList.add("pop");
          }
        }
      }
      this.updateMatchup();
    }

    /* ---------- 対戦表示 (右上): 投手・打者 ---------- */
    updateMatchup() {
      const g = this.g;
      const m = this.m;
      const el = this.el;
      const bat = g.batter();
      const pit = g.pitcher();
      const st = g.pstate[g.fieldingSide()];
      const ratio = U.clamp(st.stamina / st.max, 0, 1);
      el.muP.innerHTML =
        '<span class="mu-k">投</span><b class="mu-n">' +
        esc(pit.name) +
        '</b><span class="mu-h">' +
        (pit.throws === "L" ? "左" : "右") +
        '</span><span class="mu-x">' +
        st.pitches +
        "<small>球</small></span>";
      el.stam.style.width = Math.round(ratio * 100) + "%";
      el.stam.style.background = ratio > 0.5 ? "linear-gradient(90deg,#1fbf6a,#7dffb0)" : ratio > 0.25 ? "linear-gradient(90deg,#e0a800,#ffe27a)" : "linear-gradient(90deg,#d42020,#ff8080)";
      const bs = g.box[bat.id] || {};
      const season = m.opt.season ? m.opt.season[bat.id] : null;
      let sub;
      if (m.derby) sub = "HR " + m.derby.hr;
      else if (season && season.ab) sub = U.fmtAvg(season.h || 0, season.ab || 0);
      else sub = (bs.ab || 0) + "-" + (bs.h || 0);
      const order = m.derby ? "HR" : g.bi[g.battingSide()] + 1;
      el.muB.innerHTML =
        '<span class="mu-k">' +
        order +
        '</span><b class="mu-n">' +
        esc(bat.name) +
        '</b><span class="mu-h">' +
        (PB.P.batSide(bat, pit) === "L" ? "左" : "右") +
        '</span><span class="mu-x">' +
        esc(sub) +
        "</span>" +
        '<span class="mu-ab">' +
        PB.UI.compactAb(bat) +
        "<em>弾" +
        bat.traj +
        "</em></span>";
    }

    /* ---------- 球速 ---------- */
    pitch(pc) {
      if (!pc || !this.el) return;
      const html = "<b>" + Math.round(pc.speedKmh) + "</b><small>km/h</small><span>" + esc(pc.name || "") + "</span>";
      this.flash(this.el.spd, html, 2300, "spd");
    }

    /* ---------- 下部テロップ (打者紹介・投手紹介) ---------- */
    l3(html, ms, cls) {
      this.l3q.push({ html, ms, cls });
      if (!this.l3busy) this.l3next();
    }
    l3next() {
      const it = this.l3q.shift();
      if (!it) {
        this.l3busy = false;
        return;
      }
      this.l3busy = true;
      const el = this.el.l3;
      el.innerHTML = it.html;
      el.className = "tv-l3" + (it.cls ? " " + it.cls : "");
      void el.offsetWidth;
      el.classList.add("show");
      this.later("l3", it.ms, () => {
        el.classList.remove("show");
        el.classList.add("out");
        this.later("l3x", 380, () => {
          el.classList.remove("out");
          this.l3next();
        });
      });
    }

    l3html(team, num, name, pre, tab, chips, tabCls) {
      return (
        (pre ? '<div class="l3-pre">' + pre + "</div>" : "") +
        '<div class="l3-top">' +
        '<div class="l3-logo">' +
        logoImg(team, "l3-img") +
        "</div>" +
        '<div class="l3-main">' +
        (num != null && num !== "" ? '<b class="l3-num">' + esc(num) + "</b>" : "") +
        '<span class="l3-nm">' +
        esc(name) +
        "</span></div>" +
        '<div class="l3-tab' +
        (tabCls ? " " + tabCls : "") +
        '">' +
        esc(tab) +
        "</div></div>" +
        '<div class="l3-sub">' +
        chips.map((c) => '<span class="l3-chip">' + esc(c) + "</span>").join("") +
        "</div>"
      );
    }

    batter() {
      const g = this.g;
      const m = this.m;
      if (m.derby) return;
      const side = g.battingSide();
      const bat = g.batter();
      const t = g.teams[side];
      const ord = g.bi[side] + 1;
      const pos = g.batterPos();
      const slot = (g.order[side] || [])[g.bi[side]];
      const ph = slot && slot.pos === "PH";
      const today = g.paLog[bat.id] || [];
      const season = m.opt.season ? m.opt.season[bat.id] : null;
      const real = bat.real && bat.real.stats;
      let tab = "きょうの成績";
      let chips = today.slice();
      if (!today.length) {
        if (season && season.ab) {
          tab = "今季成績";
          chips = ["打率 " + U.fmtAvg(season.h || 0, season.ab || 0), (season.hr || 0) + "本塁打", (season.rbi || 0) + "打点"];
        } else if (real && real.avg != null) {
          tab = (bat.real.season || 2004) + "年成績";
          chips = ["打率 " + avg3(real.avg)];
          if (real.hr != null) chips.push(real.hr + "本塁打");
          if (real.rbi != null) chips.push(real.rbi + "打点");
        } else {
          chips = ["第1打席"];
        }
      }
      const pre = '<span class="l3-ord">' + ord + "番</span>" + esc(ph ? "代打" : D.POS_FULL[pos] || "") + '<span class="l3-hand">' + (bat.bats === "L" ? "左打" : bat.bats === "S" ? "両打" : "右打") + "</span>";
      this.l3(this.l3html(t, bat.num, fullName(bat), pre, ph ? "代打" : tab, chips, ph ? "red" : ""), 3400);
    }

    pitcherIntro(p, side, kind) {
      const g = this.g;
      const m = this.m;
      const t = g.teams[side];
      const season = m.opt.season ? m.opt.season[p.id] : null;
      const real = p.real && p.real.stats;
      let tab;
      let chips;
      if (season && (season.pg || season.outs)) {
        tab = "今季成績";
        const era = season.outs ? (season.er * 27) / season.outs : 0;
        chips = [(season.w || 0) + "勝" + (season.l || 0) + "敗" + (season.sv ? season.sv + "S" : ""), "防御率 " + era.toFixed(2)];
      } else if (real && (real.w != null || real.era != null)) {
        tab = (p.real.season || 2004) + "年成績";
        chips = [];
        if (real.w != null) chips.push(real.w + "勝" + (real.l || 0) + "敗" + (real.sv ? real.sv + "S" : ""));
        if (real.era != null) chips.push("防御率 " + Number(real.era).toFixed(2));
      } else {
        tab = "球速";
        chips = ["最速 " + p.velo + "km/h"];
      }
      const pre = '<span class="l3-ord">' + (kind === "change" ? "ピッチャー交代" : "先発") + "</span>" + (p.throws === "L" ? "左投" : "右投");
      this.l3(this.l3html(t, p.num, fullName(p), pre, tab, chips, kind === "change" ? "red" : ""), kind === "change" ? 2600 : 2400);
    }

    /* ---------- ホームラン ---------- */
    // extra: 「2者連続」「先頭打者」など (帯の右に小さく)
    homeRun(res, bat, extra) {
      const g = this.g;
      const m = this.m;
      const season = m.opt.season;
      const n = res.runs || 1;
      const label = n >= 4 ? "満塁" : n === 1 ? "ソロ" : n + "ラン";
      const walkoff = !g.top && g.inning >= g.innings && g.score.home + n > g.score.away && g.score.home <= g.score.away;
      let no = "";
      if (season && !m.derby) no = ((season[bat.id] || {}).hr || 0) + ((g.box[bat.id] || {}).hr || 0) + 1;
      let kindTx = walkoff ? "サヨナラ" : no ? label : res.type === "IPHR" ? "ランニング" : "";
      if (extra && !walkoff) kindTx = extra + (no ? " " + label : "");
      const title = n >= 4 ? "GRAND SLAM" : "HOME RUN";
      this.band(esc(bat.name), no ? '<span class="hr-no">' + no + "<small>号</small></span>" : '<span class="hr-no lbl">' + esc(label) + "</span>", kindTx, title, 2700, res.type === "IPHR" ? "iphr" : "");
    }
    // 2 本のレールと帯の大きなテロップ (ホームラン・サヨナラ)
    band(nameHtml, noHtml, kindTx, title, ms, cls) {
      const html =
        '<div class="hr-wrap">' +
        '<div class="hr-rail t"></div><div class="hr-rail b"></div>' +
        '<div class="hr-bar"><span class="hr-nm">' +
        nameHtml +
        "</span>" +
        noHtml +
        '<span class="hr-kind">' +
        esc(kindTx) +
        "</span></div>" +
        '<div class="hr-title"><span data-t="' +
        esc(title) +
        '">' +
        esc(title) +
        "</span></div>" +
        '<div class="hr-shine"></div>' +
        "</div>";
      this.hide("l3");
      this.hide("call");
      this.flash(this.el.hr, html, ms, "hr", cls);
    }
    // サヨナラの赤い帯: what = 「サヨナラタイムリー」など
    walkoff(bat, what) {
      this.band(esc(bat.name), "", what || "", "サヨナラ", 3400, "wo");
    }

    /* ---------- 得点 (中央の大きなスコア) ---------- */
    // kind: "score" | "final" | "open"
    scoreBoard(kind) {
      const g = this.g;
      const m = this.m;
      const last = g.scoreLog[g.scoreLog.length - 1];
      let gold = null;
      let mid;
      if (kind === "final") {
        mid = "試合終了";
        if (g.score.home !== g.score.away) gold = g.score.home > g.score.away ? "home" : "away";
      } else if (kind === "open") {
        mid = "プレイボール";
      } else {
        gold = last ? last.side : g.battingSide();
        mid = last ? innLong(last.inning, last.top) : innLong(g.inning, g.top);
      }
      const panel = (side) => {
        const t = teamOf(g.teams[side]);
        const c = t.main || "#335";
        const bg = "linear-gradient(160deg," + shade(c, 0.35) + " 0%," + shade(c, 0.08) + " 42%," + shade(c, -0.35) + " 100%)";
        const nm = String(t.short || t.name);
        let body;
        if (kind === "open") {
          const sp = g.P(g.pstate[side].id);
          body = '<div class="sp-k">先発</div><div class="sp-n">' + esc(sp.name) + "</div>";
        } else {
          const cur = g.score[side];
          const prev = kind === "score" && last && last.side === side ? cur - last.n : cur;
          body = '<div class="sc-num" data-side="' + side + '" data-to="' + cur + '">' + mnum(prev, side === gold ? "gold" : "silver") + "</div>";
        }
        return (
          '<div class="sc-panel ' +
          side +
          (side === gold ? " win" : "") +
          '" style="--pc:' +
          c +
          ";background:" +
          bg +
          '">' +
          '<div class="sc-logo">' +
          logoImg(t, "sc-img") +
          "</div>" +
          '<div class="sc-name' +
          (nm.length >= 4 ? " long" : "") +
          '">' +
          esc(nm) +
          "</div>" +
          body +
          '<div class="sc-gloss"></div></div>'
        );
      };
      // 先制・同点・逆転・勝ち越しは大きな判子で
      const stamp = kind === "score" && last && ["先制", "同点", "逆転", "勝ち越し", "サヨナラ"].indexOf(last.ctx) >= 0 ? '<div class="sc-stamp' + (last.ctx === "逆転" || last.ctx === "サヨナラ" ? " red" : "") + '"><span>' + esc(last.ctx) + "</span></div>" : "";
      const extra =
        kind === "score" && last
          ? stamp + '<div class="sc-ctx">' + esc(last.text) + "</div>"
          : kind === "open"
            ? '<div class="sc-ctx">' + esc(teamOf(g.teams.home).stadium || "") + "</div>"
            : kind === "final" && g.result
              ? '<div class="sc-ctx">' + this.finalPitchers() + "</div>"
              : "";
      // 中継の慣習どおり ホーム球団を左に
      const html = '<div class="sc-row">' + panel("home") + '<div class="sc-mid"><div class="sc-inn">' + esc(mid) + '</div><div class="sc-prog">' + PROGRAM + "</div></div>" + panel("away") + "</div>" + extra;
      const ms = kind === "final" ? 2900 : kind === "open" ? 2600 : 2300;
      this.flash(this.el.center, html, ms, "center", "k-" + kind);
      // 点が入った側の数字を差し替える (左上のカウント表示も同時に)
      if (kind === "score") {
        this.later("scnum", 650, () => {
          this.el.center.querySelectorAll(".sc-num").forEach((e) => {
            const to = e.getAttribute("data-to");
            const b = e.querySelector(".mnum");
            if (b && b.textContent !== to) {
              b.textContent = to;
              b.setAttribute("data-t", to);
              b.classList.add("pop");
            }
          });
          this.syncScore();
        });
      } else this.syncScore();
    }

    // カウント表示の得点を今の数字に
    syncScore() {
      this.bugSeen = this.g.scoreLog.length;
      this.update();
    }

    finalPitchers() {
      const g = this.g;
      const r = g.result;
      const nm = (id) => (id ? esc(g.P(id).name) : "");
      let s = "";
      if (r.W) s += '<span class="fp w">勝</span>' + nm(r.W);
      if (r.L) s += '<span class="fp l">敗</span>' + nm(r.L);
      if (r.S) s += '<span class="fp s">S</span>' + nm(r.S);
      return s || "引き分け";
    }

    /* ---------- 今日の結果 (下部の流れるテロップ) ---------- */
    tickerLine(e) {
      const g = this.g;
      const ab = (side) => esc(abbr(teamOf(g.teams[side])));
      return (
        '<span class="tk-who">(' +
        ab(e.side) +
        ")" +
        e.inning +
        (e.top ? "表" : "裏") +
        "</span>" +
        esc(e.text) +
        '<span class="tk-sc">(' +
        ab("home") +
        e.score.home +
        "－" +
        e.score.away +
        ab("away") +
        ")</span>"
      );
    }
    // entries: 得点の場面 (scoreLog) または { label, html } (投手成績・次の回など)
    ticker(entries, label) {
      if (!entries.length) return;
      const el = this.el.tick;
      let i = 0;
      const per = 2300;
      const render = () => {
        const e = entries[i];
        const lb = e.html != null ? e.label : label || "今日の結果";
        el.innerHTML = '<div class="tk-tab' + (e.cls ? " " + e.cls : "") + '">' + esc(lb) + '</div><div class="tk-body"><div class="tk-line">' + (e.html != null ? e.html : this.tickerLine(e)) + "</div></div>";
        const line = el.querySelector(".tk-line");
        const body = el.querySelector(".tk-body");
        // 長い行は横に流す
        requestAnimationFrame(() => {
          const over = line.scrollWidth - body.clientWidth;
          if (over > 4) {
            line.style.setProperty("--dx", -over - 8 + "px");
            line.classList.add("scroll");
          }
        });
      };
      render();
      el.className = "tv-tick";
      void el.offsetWidth;
      el.classList.add("show");
      const step = () => {
        i++;
        if (i >= entries.length) {
          el.classList.remove("show");
          el.classList.add("out");
          this.later("tickx", 450, () => {
            el.classList.remove("out");
            el.innerHTML = "";
          });
          return;
        }
        render();
        this.later("tick", per, step);
      };
      this.later("tick", per, step);
    }

    /* ---------- 攻守交代: 中継風のスコアボード ---------- */
    inningBoard() {
      const g = this.g;
      // 終わったイニング
      const endInn = g.top ? g.inning - 1 : g.inning;
      const endTop = !g.top;
      const n = Math.max(g.line.away.length, g.line.home.length, g.innings);
      const row = (side) => {
        const t = teamOf(g.teams[side]);
        let s = '<tr><th><span class="bd-logo">' + logoImg(t, "bd-img") + "</span>" + esc(t.short || "") + "</th>";
        for (let i = 0; i < n; i++) {
          const v = g.line[side][i];
          s += "<td" + (i === endInn - 1 && ((side === "away" && endTop) || (side === "home" && !endTop)) ? ' class="cur"' : "") + ">" + (v == null ? "" : v) + "</td>";
        }
        return s + '<td class="r">' + g.score[side] + '</td><td class="h">' + g.hits[side] + '</td><td class="h">' + g.errors[side] + "</td></tr>";
      };
      const head = "<tr><th></th>" + Array.from({ length: n }, (_, i) => "<td>" + (i + 1) + "</td>").join("") + '<td class="r">R</td><td class="h">H</td><td class="h">E</td></tr>';
      const html =
        '<div class="bd"><div class="bd-head"><span class="bd-tab">' +
        endInn +
        "回" +
        (endTop ? "表" : "裏") +
        '終了</span><span class="bd-prog">' +
        PROGRAM +
        '</span></div><div class="bd-tbl"><table>' +
        head +
        row("away") +
        row("home") +
        "</table></div></div>";
      this.flash(this.el.center, html, 2500, "center", "k-board");
      const list = this.inningInfo();
      if (list.length) this.ticker(list, "今日の結果");
      return list.length;
    }

    // 攻守交代の下のテロップ: その回の得点 + 回ごとに替わる話題 (投手成績・当たっている打者・次の回の先頭・安打数)
    inningInfo() {
      const g = this.g;
      const endTop = !g.top;
      const endInn = g.top ? g.inning - 1 : g.inning;
      const out = g.scoreLog.filter((e) => e.inning === endInn && e.top === endTop).slice(-2);
      const ab = (side) => esc(abbr(teamOf(g.teams[side])));
      const k = (this.breakN = (this.breakN || 0) + 1);
      const topics = [];
      // 終わった回を投げていた投手
      const fs = endTop ? "home" : "away";
      const ps = g.pstate[fs];
      if (ps) {
        const pit = g.P(ps.id);
        const s = g.box[ps.id] || {};
        if (pit && (s.outs || 0) >= 6) topics.push({ label: "投手成績", html: '<span class="tk-who">(' + ab(fs) + ")</span>" + esc(pit.name) + " " + U.fmtIP(s.outs || 0) + "回 " + (s.np || 0) + "球 " + (s.pk || 0) + "奪三振 " + (s.pr || 0) + "失点" });
      }
      // 当たっている打者 (まだ紹介していない人)
      this.tkShown = this.tkShown || {};
      for (const side of ["away", "home"]) {
        for (const e of g.order[side] || []) {
          const s = g.box[e.id] || {};
          const key = e.id + ":" + (s.h || 0);
          if (((s.h || 0) >= 2 || (s.hr || 0) >= 1) && !this.tkShown[key]) {
            const p = g.P(e.id);
            topics.push({ label: "今日の打撃", key, html: '<span class="tk-who">(' + ab(side) + ")</span>" + esc(p.name) + " " + (s.ab || 0) + "打数" + (s.h || 0) + "安打" + (s.hr ? " " + s.hr + "本塁打" : "") + (s.rbi ? " " + s.rbi + "打点" : "") });
            break;
          }
        }
      }
      // 次の回の先頭打者
      const bs = g.battingSide();
      const nb = g.batter();
      if (nb) {
        const ord = g.bi[bs] + 1;
        topics.push({ label: "この回は", html: '<span class="tk-who">(' + ab(bs) + ")</span>" + ord + "番 " + esc(nb.name) + "から" + (ord >= 3 && ord <= 5 ? " クリーンアップ" : "") });
      }
      topics.push({ label: "ここまで", html: ab("away") + " " + g.hits.away + "安打 － " + ab("home") + " " + g.hits.home + "安打" });
      // 回ごとに 1 つ (得点がなかった回は 2 つ)
      const want = out.length ? 1 : 2;
      for (let i = 0; i < Math.min(want, topics.length); i++) {
        const t = topics[(k + i) % topics.length];
        out.push(t);
        if (t.key) this.tkShown[t.key] = 1;
      }
      return out;
    }

    /* ---------- 判定・結果の小さな帯 (右下) ---------- */
    // cls: hit | out | k | safe | info | fine | chance。o: { stamp: "SAFE" など, ms, hold: 次の帯を出すまで最低これだけ見せる (ms), color }
    call(text, cls, o) {
      const opt = o || {};
      const show = () => {
        this.callHold = performance.now() + (opt.hold || 0);
        const html = (opt.stamp ? '<b class="cl-st">' + esc(opt.stamp) + "</b>" : "") + (text ? '<span class="cl-bar"><span class="cl-tx">' + esc(text) + "</span></span>" : "");
        this.flash(this.el.call, html, opt.ms || 1500, "call", cls);
        this.el.call.style.setProperty("--cc", opt.color || "");
      };
      const wait = (this.callHold || 0) - performance.now();
      clearTimeout(this.timers.callq);
      if (wait > 30) this.later("callq", wait, show);
      else show();
    }

    /* ---------- 三振の K ボード ---------- */
    // list: この投手の今日の三振 ("S" 空振り / "L" 見逃し = 裏返しの K)。side: 打者と反対側 "l" | "r"
    kBoard(pit, list, side) {
      const shown = list.slice(-12);
      const tiles = shown.map((k, i) => '<i class="' + (k === "L" ? "rev" : "") + (i === shown.length - 1 ? " new" : "") + '">K</i>').join("");
      const html = '<div class="kb-h"><span class="kb-n">' + esc(pit.name) + "</span><span><b>" + list.length + "</b><small>奪三振</small></span></div>" + '<div class="kb-l">' + tiles + "</div>";
      this.flash(this.el.k, html, 2300, "k", side === "l" ? "l" : "r");
    }

    /* ---------- 場内アナウンス (字幕を 1 文字ずつ) ---------- */
    pa(text, ms) {
      const el = this.el.pa;
      this.flash(el, '<span class="pa-k">場内</span><span class="pa-t"></span>', ms || 2400, "pa");
      const t = el.querySelector(".pa-t");
      const chars = Array.from(text);
      let i = 0;
      const step = () => {
        i++;
        t.textContent = chars.slice(0, i).join("");
        if (i < chars.length) this.later("paT", 32, step);
      };
      step();
    }

    /* ---------- 打席・マウンドに向かう選手のカード ---------- */
    // 白く光って現れ、少しして縮んで消える。o: { side: "l" | "r", home, kind, tag, fetch, wait, ms }
    card(p, team, o) {
      const opt = o || {};
      const el = this.el.card;
      const w = U.clamp(Math.round(window.innerWidth * 0.22), 72, 112);
      const c = cardFor(p, team, { w, mini: true, home: opt.home, kind: opt.kind, fetch: opt.fetch !== false });
      const tok = (this.cardTok = (this.cardTok || 0) + 1);
      let done = false;
      // 選手の画像が描けるのを少しだけ待つ (間に合わなければ今ある絵で)
      const show = () => {
        if (done || tok !== this.cardTok) return;
        done = true;
        this.flash(el, '<div class="cd-in"></div>' + (opt.tag ? '<div class="cd-tag">' + esc(opt.tag) + "</div>" : ""), opt.ms || 1700, "card", opt.side === "l" ? "l" : "r");
        el.querySelector(".cd-in").appendChild(c.cv);
      };
      c.ready.then(show);
      this.later("cardw", opt.wait != null ? opt.wait : 650, show);
    }

    /* ---------- 推定飛距離 ---------- */
    dist(m, where) {
      this.flash(this.el.dist, '<span class="ds-k">推定飛距離</span><b>' + m + "</b><small>m</small>" + (where ? '<span class="ds-w">' + esc(where) + "</span>" : ""), 2600, "dist");
    }

    /* ---------- ラッキー 7 ---------- */
    lucky7(team) {
      const t = teamOf(team);
      const html = '<div class="l7-in" style="--c1:' + (t.main || "#c00") + ";--c2:" + (t.sub || "#fff") + '"><div class="l7-logo">' + logoImg(t, "l7-img") + '</div><div class="l7-t"><b>LUCKY 7</b><span>' + esc(t.short || t.name) + "の攻撃</span></div></div>";
      this.flash(this.el.l7, html, 2600, "l7");
    }

    /* ---------- 勝利投手・セーブ・今日のヒーロー ---------- */
    // o: { hero: 選手 id, heroLine, ms }
    winLoss(o) {
      const g = this.g;
      const r = g.result || {};
      if (!r.winner) return false;
      const side = r.winner;
      const t = g.teams[side];
      const pl = (id) => {
        const s = g.box[id] || {};
        return U.fmtIP(s.outs || 0) + "回 " + (s.pr || 0) + "失点" + (s.pk ? " " + s.pk + "奪三振" : "");
      };
      const rows = [];
      if (r.W) rows.push(["w", "勝利投手", g.P(r.W).name, pl(r.W)]);
      if (r.S) rows.push(["s", "セーブ", g.P(r.S).name, pl(r.S)]);
      if (o.hero && o.hero !== r.W) rows.push(["h", "今日のヒーロー", g.P(o.hero).name, o.heroLine || ""]);
      const html =
        '<div class="wl-in" style="--tc:' +
        (teamOf(t).main || "#333") +
        '"><div class="wl-card"></div><div class="wl-rows">' +
        rows.map((x, i) => '<div class="wl-r ' + x[0] + '" style="--i:' + i + '"><span class="wl-k">' + esc(x[1]) + "</span><b>" + esc(x[2]) + "</b><small>" + esc(x[3]) + "</small></div>").join("") +
        "</div></div>";
      this.flash(this.el.wl, html, o.ms || 3000, "wl");
      const wp = r.W ? g.P(r.W) : null;
      if (wp) {
        const c = cardFor(wp, t, { w: U.clamp(Math.round(window.innerWidth * 0.28), 92, 136), home: side === "home", kind: "pit", fetch: true });
        this.el.wl.querySelector(".wl-card").appendChild(c.cv);
      }
      return true;
    }

    /* ---------- ヒーローインタビュー ---------- */
    // o: { p, team, home, lines: [[質問, 答え], …], chips, last: 最後のひと言, ms }
    hero(o) {
      const el = this.el.hero;
      const html =
        '<div class="hro-bg"></div><div class="hro-tab">HERO INTERVIEW</div><div class="hro-card"></div><div class="hro-qa"></div>' +
        '<div class="hro-l3">' +
        this.l3html(o.team, o.p.num, fullName(o.p), '<span class="l3-ord">ヒーローインタビュー</span>', "今日のヒーロー", o.chips || [], "gold") +
        "</div>";
      this.flash(el, html, o.ms || 8500, "hero");
      const c = cardFor(o.p, o.team, { w: U.clamp(Math.round(window.innerWidth * 0.4), 120, 190), home: o.home, kind: o.p.pos === "P" ? "pit" : "bat", fetch: true });
      el.querySelector(".hro-card").appendChild(c.cv);
      const qa = el.querySelector(".hro-qa");
      const bubble = (cls, text, key) => {
        const b = document.createElement("div");
        b.className = "hro-b " + cls;
        qa.appendChild(b);
        const chars = Array.from(text);
        let i = 0;
        const step = () => {
          i++;
          b.textContent = chars.slice(0, i).join("");
          if (i < chars.length) this.later(key, 34, step);
        };
        step();
      };
      let at = 600;
      const lines = (o.lines || []).slice(0, 2);
      lines.forEach((l, i) => {
        this.later("hq" + i, at, () => {
          qa.innerHTML = "";
          bubble("q", l[0], "hqT" + i);
        });
        this.later("ha" + i, at + 1100, () => bubble("a", l[1], "haT" + i));
        at += 3000;
      });
      if (o.last)
        this.later("hl", at, () => {
          qa.innerHTML = "";
          bubble("a last", o.last, "hlT");
        });
    }
    heroLines(kind, vars) {
      const list = HERO[kind] || HERO.hit;
      return list.map((l) => [pick([l[0]], vars), pick([l[1]], vars)]);
    }

    /* ---------- スタメン発表 ---------- */
    // 両軍 9 人のカードが裏から 1 枚ずつ返り、下に先発投手。カードは写真・描いたことのある選手・2 頭身だけ (新しく 3D の選手は描かない)
    lineup(o) {
      const g = this.g;
      const opt = o || {};
      const rh = Math.round(U.clamp((window.innerHeight - 250) / 10.6, 22, 52));
      const cw = Math.round(rh * 0.78);
      const col = (side) => {
        const t = teamOf(g.teams[side]);
        const rows = (g.order[side] || [])
          .map((e, i) => {
            const p = g.P(e.id);
            return '<div class="lu-r" style="--i:' + (i * 2 + (side === "home" ? 1 : 0)) + '"><div class="lu-c" data-k="' + side + i + '"></div><b class="lu-o">' + (i + 1) + '</b><span class="lu-p">' + esc(D.POS_JP[e.pos] || "") + '</span><span class="lu-n">' + esc(p ? p.name : "") + "</span></div>";
          })
          .join("");
        return '<div class="lu-col ' + side + '" style="--tc:' + (t.main || "#334") + '"><div class="lu-th">' + logoImg(t, "lu-img") + "<b>" + esc(t.short || t.name) + "</b></div>" + rows + "</div>";
      };
      const sp = (side) => {
        const p = g.P(g.pstate[side].id);
        return '<div class="lu-s ' + side + '"><div class="lu-c" data-k="' + side + 'sp"></div><div><span class="lu-sk">先発</span><b>' + esc(p.name) + "</b></div></div>";
      };
      const home = teamOf(g.teams.home);
      const away = teamOf(g.teams.away);
      const html =
        '<div class="lu-in" style="--rh:' +
        rh +
        'px"><div class="lu-head"><span class="lu-tab">スターティングメンバー</span><span class="lu-sub">' +
        esc((opt.title ? opt.title + "　" : "") + (away.short || away.name) + " vs " + (home.short || home.name) + (home.stadium ? "　" + home.stadium : "")) +
        '</span></div><div class="lu-cols">' +
        col("away") +
        col("home") +
        '</div><div class="lu-sp">' +
        sp("away") +
        sp("home") +
        "</div></div>";
      this.flash(this.el.lu, html, opt.ms || 6000, "lu");
      const slot = (k) => this.el.lu.querySelector('[data-k="' + k + '"]');
      for (const side of ["away", "home"]) {
        const t = g.teams[side];
        (g.order[side] || []).forEach((e, i) => {
          const p = g.P(e.id);
          const s = slot(side + i);
          if (p && s) s.appendChild(cardFor(p, t, { w: cw, mini: true, home: side === "home", fetch: false, pos: e.pos }).cv);
        });
        const s = slot(side + "sp");
        const sp1 = g.P(g.pstate[side].id);
        if (s && sp1) s.appendChild(cardFor(sp1, t, { w: Math.round(cw * 1.25), mini: true, home: side === "home", kind: "pit", fetch: false }).cv);
      }
    }
    lineupOut() {
      this.el.lu.classList.add("leave");
    }

    // 3D の選手の絵を先に描いておく (攻守交代など、止まっている間に)
    prefetch(p, team, o) {
      const C = PB.Cards;
      if (!C || !(PB.View3D && PB.View3D.active)) return;
      const tt = teamOf(team);
      const key = pkey(p, tt, o);
      if (pcache.has(key)) return;
      C.portraitOf(p, tt, o).then(
        (im) => {
          if (im) pcache.set(key, im);
        },
        () => {}
      );
    }
  }

  PB.TV = TV;
  PB.TV.fullName = fullName;
  PB.TV.POS_PA = POS_PA;
  PB.TV.teamOf = teamOf;
  // 実況・解説の文を選ぶ (直近と同じ文は避ける)
  PB.TV.talk = (key, vars) => pick(PHR[key] || [key], vars);
  PB.TV.kai = (key, vars) => (KAI[key] ? pick(KAI[key], vars) : "");
})(window.PB);
