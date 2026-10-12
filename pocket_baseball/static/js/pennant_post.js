/* 熱闘！ポケットベースボール — ペナントのポストシーズン (2004 年: パ・リーグ プレーオフ → 日本シリーズ)
 * 組み合わせ・系列の進行 (日程の後ろに 1 日ずつ足す)・ハブ/開幕/決着の画面。
 * 2004 年: パは第1ステージ (2位-3位・3試合制) → 第2ステージ (1位-勝者・5試合制。1位が2位に5ゲーム差以上なら1勝のアドバンテージ)。
 *   勝者がパ・リーグ優勝 (レギュラーシーズン1位は「1位通過」)。セはプレーオフなし。日本シリーズは 4 勝先取 (2-3-2)。
 * 後年ルール (2007 年〜の方式・このゲームの設定): 両リーグのクライマックスシリーズ (ファイナルは 1 位に 1 勝)。
 * ポストシーズンの試合は pen.results に ps 付きで入れ、成績は pen.post.stats[系列] に分ける (pen.stats には足さない)。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const UI = PB.UI;
  const Store = PB.Store;
  const Sc = PB.Screens;
  const esc = U.esc;
  const Pen = () => PB.Pennant;
  const PP = {};

  // 2004 年のルール (確度の低いものは要確認。画面にも「ゲームの設定」と出す)
  const R = (PB.RULES_2004 = PB.RULES_2004 || {});
  R.post = {
    advGap: 5, // 第2ステージ: 1 位が 2 位に 5.0 ゲーム差以上で 1 勝のアドバンテージ (2004 年は 4.5 差で適用なし)
    extra: { po: 12, js: 15, js8: 99 }, // 延長の上限 (要確認): プレーオフ 12 回・日本シリーズ 15 回・第 8 戦以降は制限なし
    gapStart: 2, // レギュラーシーズン最終日から第 1 戦まで (日数・ゲームの設定)
    gapRound: 2, // ステージの間
    gapJS: 3, // 日本シリーズの前
    gapAward: 2, // 表彰式
    jsHome: [1, 1, 0, 0, 0, 1, 1], // 2-3-2 (1 = 第 1 戦の主催球団)
  };
  const P0 = R.post;

  // 系列の定義
  const DEF = {
    "2004": {
      P1: { lg: "P", round: 1, name: "パ・リーグ プレーオフ 第1ステージ", group: "パ・リーグ プレーオフ", stage: "第1ステージ", tag: "第1ステージ", need: 2, max: 3 },
      P2: { lg: "P", round: 2, name: "パ・リーグ プレーオフ 第2ステージ", group: "パ・リーグ プレーオフ", stage: "第2ステージ", tag: "第2ステージ", need: 3, max: 5, cel: "lg" },
      JS: { lg: null, round: 3, name: "日本シリーズ", group: "日本シリーズ", stage: "日本シリーズ", tag: "日本シリーズ", need: 4, max: 0, cel: "js" },
    },
    cs: {
      C1: { lg: "C", round: 1, name: "セ・リーグ CS ファーストステージ", group: "セ・リーグ クライマックスシリーズ", stage: "ファーストステージ", tag: "CSファースト", need: 2, max: 3 },
      P1: { lg: "P", round: 1, name: "パ・リーグ CS ファーストステージ", group: "パ・リーグ クライマックスシリーズ", stage: "ファーストステージ", tag: "CSファースト", need: 2, max: 3 },
      C2: { lg: "C", round: 2, name: "セ・リーグ CS ファイナルステージ", group: "セ・リーグ クライマックスシリーズ", stage: "ファイナルステージ", tag: "CSファイナル", need: 4, max: 6, cel: "cs" },
      P2: { lg: "P", round: 2, name: "パ・リーグ CS ファイナルステージ", group: "パ・リーグ クライマックスシリーズ", stage: "ファイナルステージ", tag: "CSファイナル", need: 4, max: 6, cel: "cs" },
      JS: { lg: null, round: 3, name: "日本シリーズ", group: "日本シリーズ", stage: "日本シリーズ", tag: "日本シリーズ", need: 4, max: 0, cel: "js" },
    },
  };
  PP.DEF = DEF;
  const LG_SHORT = { C: "セ・リーグ", P: "パ・リーグ" };

  const team = (id) => Pen().team(id) || { id, short: "?", name: "?", players: [] };
  function abbr(id) {
    const d = D.teamDef ? D.teamDef(id) : null;
    return (d && d.abbr) || String(team(id).short || "?").slice(0, 1);
  }
  const yearOf = (pen) => pen.year || 2004;

  /* ---------- 組み合わせ ---------- */
  // 最終順位から系列を作る。st = { C: [順位表], P: [順位表] } を渡せばそれを使う (テスト用)
  PP.bracket = function (pen, rules, stIn) {
    const st = stIn || { C: Pen().standings(pen, "C"), P: Pen().standings(pen, "P") };
    const cs = rules === "cs";
    const defs = DEF[cs ? "cs" : "2004"];
    const mk = (id, hi, lo, extra) => Object.assign({ id, hi, lo, seeds: [1, 0], adv: 0, w: [0, 0], t: 0, games: [], win: null, lose: null, start: null, end: null }, defs[id], extra || {});
    const series = [];
    const champs = { C: st.C[0] ? st.C[0].id : null, P: null, P1st: st.P[0] ? st.P[0].id : null, JS: null, cs: {} };
    if (!cs) {
      // パ: 第1ステージ 2位-3位 (全試合 2 位の本拠地)、第2ステージ 1位-勝者 (全試合 1 位の本拠地)
      series.push(mk("P1", st.P[1].id, st.P[2].id, { seeds: [2, 3] }));
      const gap = st.P[1].gb;
      const adv = gap >= P0.advGap ? 1 : 0;
      series.push(mk("P2", st.P[0].id, null, { seeds: [1, 0], adv, gap, w: [adv, 0] }));
      series.push(mk("JS", champs.C, null));
    } else {
      // CS (後年ルール): 両リーグ。リーグ優勝はレギュラーシーズン 1 位、ファイナルは 1 位に 1 勝
      champs.P = st.P[0].id;
      for (const lg of ["C", "P"]) {
        series.push(mk(lg + "1", st[lg][1].id, st[lg][2].id, { seeds: [2, 3] }));
        series.push(mk(lg + "2", st[lg][0].id, null, { seeds: [1, 0], adv: 1, w: [1, 0] }));
      }
      series.push(mk("JS", null, null));
    }
    return { rules: cs ? "cs" : "2004", series, champs };
  };

  // 第 n 戦 (1 から) の主催球団。プレーオフ・CS は上位の本拠地、日本シリーズは 2-3-2 (偶数年はセが第 1 戦)
  PP.firstHost = (s, year) => (year % 2 === 0 ? s.hi : s.lo);
  PP.homeOf = function (s, n, year) {
    if (s.id !== "JS") return s.hi;
    const first = PP.firstHost(s, year);
    const other = first === s.hi ? s.lo : s.hi;
    if (n > P0.jsHome.length) return first; // 第 8 戦以降 (引き分けがあったとき) は第 1 戦の主催球団 (要確認)
    return P0.jsHome[n - 1] ? first : other;
  };

  // 勝ち抜け: need 勝 (アドバンテージを含む) / 規定の試合数を終えて並んだら上位 / 残りで結果が変わらなくなったら終了 (ゲームの設定)
  // 日本シリーズ (max 0) は 4 勝するまで続ける
  function decide(s, w, played) {
    const a = w[0];
    const b = w[1];
    if (a >= s.need) return s.hi;
    if (b >= s.need) return s.lo;
    if (!s.max) return null;
    const rem = s.max - played;
    if (rem <= 0) return a >= b ? s.hi : s.lo;
    if (b + rem < s.need && b + rem <= a) return s.hi;
    if (a + rem < s.need && a + rem < b) return s.lo;
    return null;
  }
  PP.decide = decide;
  // 第 n 戦を終えた時点の状態 (n = 0 は開幕前)
  PP.stateAt = function (s, n) {
    const w = [s.adv || 0, 0];
    let t = 0;
    let win = null;
    const k = Math.min(n, s.games.length);
    for (let i = 0; i < k; i++) {
      const g = s.games[i];
      const hiScore = g.home === s.hi ? g.hs : g.as;
      const loScore = g.home === s.hi ? g.as : g.hs;
      if (hiScore > loScore) w[0]++;
      else if (loScore > hiScore) w[1]++;
      else t++;
      win = decide(s, w, i + 1);
      if (win) return { w, t, n: i + 1, win };
    }
    return { w, t, n: k, win };
  };

  PP.series = (pen, sid) => (pen.post && pen.post.series ? pen.post.series.find((s) => s.id === sid) : null) || null;
  const regDays = (pen) => pen.regDays || pen.schedule.length;

  /* ---------- 進行 (日程の後ろに 1 日ずつ足す) ---------- */
  function pushDay(pen, games, gap) {
    const idx = pen.schedule.length;
    pen.schedule.push(games);
    if (pen.dates && pen.dates.length === idx && idx > 0) pen.dates.push(pen.dates[idx - 1] + Math.max(1, gap || 1));
    return idx;
  }
  const active = (P) => P.series.filter((s) => s.round === P.round && !s.win && s.hi && s.lo);
  // 次のステージの組み合わせを埋める。もう無ければ false
  function advance(pen) {
    const P = pen.post;
    const next = P.round + 1;
    const ss = P.series.filter((s) => s.round === next);
    if (!ss.length) return false;
    const won = (id) => (PP.series(pen, id) || {}).win || null;
    for (const s of ss) {
      if (s.id === "JS") {
        s.hi = P.rules === "cs" ? won("C2") : P.champs.C;
        s.lo = won("P2");
      } else s.lo = won(s.lg + "1");
    }
    P.round = next;
    return true;
  }
  // 表彰式の日 (試合なし)。シーズンの表彰はこの日に発表する
  function appendAwardsDay(pen) {
    if (pen.awardsDay != null) return;
    const idx = pushDay(pen, [], P0.gapAward);
    pen.awardsDay = idx;
    if (PB.PenAwards) {
      try {
        PB.PenAwards.decideSeason(pen, idx);
      } catch (err) {
        console.error(err);
      }
    }
  }
  PP.appendAwardsDay = appendAwardsDay;
  // 次の試合の日を足す (今のステージが終わっていれば次のステージ・表彰式)
  function appendDay(pen, gapIn) {
    const P = pen.post;
    let act = active(P);
    let gap = gapIn;
    if (!act.length) {
      if (!advance(pen)) return appendAwardsDay(pen);
      act = active(P);
      if (!act.length) return appendAwardsDay(pen);
      gap = P.round >= 3 ? P0.gapJS : P0.gapRound;
    }
    if (gap == null) {
      gap = 1;
      // 日本シリーズの移動日 (第 3 戦・第 6 戦の前)
      for (const s of act) if (s.id === "JS" && (s.games.length + 1 === 3 || s.games.length + 1 === 6)) gap = 2;
    }
    const y = yearOf(pen);
    const games = act.map((s) => {
      const n = s.games.length + 1;
      const home = PP.homeOf(s, n, y);
      return { home, away: home === s.hi ? s.lo : s.hi, ps: s.id, g: n };
    });
    const idx = pushDay(pen, games, gap);
    for (const s of act) if (s.start == null) s.start = idx;
  }

  // レギュラーシーズンの終わり (regularEnd フック)
  PP.start = function (pen) {
    if (pen.legacyEnd || (pen.post && pen.post.series && pen.post.series.length) || pen.awardsDay != null) return;
    if (!pen.opts || !pen.opts.post) {
      pen.post = null;
      appendAwardsDay(pen);
      return;
    }
    const b = PP.bracket(pen, pen.opts.cs ? "cs" : "2004");
    const stats = (pen.post && pen.post.stats) || {};
    pen.post = Object.assign({ v: 1, round: 1, stats, seen: {}, cel: {}, mvp: {} }, b);
    appendDay(pen, P0.gapStart);
  };

  // 試合ごと (afterGame フック): 系列の勝敗を更新
  PP.onGame = function (pen, m, game, r) {
    if (!r.ps || !pen.post) return;
    const s = PP.series(pen, r.ps);
    if (!s || s.win || s.games.some((g) => g.day === r.day && g.gi === r.gi)) return;
    s.games.push({ day: r.day, gi: r.gi, n: r.gn, home: r.home, away: r.away, hs: r.hs, as: r.as, inn: r.inn, wo: r.wo ? 1 : 0 });
    const st = PP.stateAt(s, s.games.length);
    s.w = st.w;
    s.t = st.t;
    if (st.win) {
      s.win = st.win;
      s.lose = st.win === s.hi ? s.lo : s.hi;
      s.end = r.day;
      const P = pen.post;
      if (s.id === "JS") P.champs.JS = s.win;
      else if (s.round === 2 && P.rules === "2004") P.champs.P = s.win; // 2004 年: プレーオフの勝者がパ・リーグ優勝
      else if (s.round === 2) P.champs.cs[s.lg] = s.win;
      // 系列の MVP (優勝・日本一の系列。乱数を使わない)
      if (PB.PenAwards && (s.cel || s.round === 2)) {
        try {
          P.mvp[s.id] = PB.PenAwards.seriesMVP(pen, s);
          if (s.id === "JS") P.mvp.JSf = PB.PenAwards.seriesMVP(pen, s, true);
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  // 1 日の終わり (afterDay フック): 次の試合の日 (または表彰式) を足す
  PP.afterDay = function (pen, day) {
    if (day < regDays(pen) || !pen.post || !pen.post.series || day === pen.awardsDay || pen.awardsDay != null) return;
    if (pen.post.appended != null && pen.post.appended >= day) return;
    pen.post.appended = day;
    appendDay(pen, null);
  };

  if (PB.Pennant && PB.Pennant.hooks) {
    PB.Pennant.hooks.regularEnd.push((pen) => PP.start(pen));
    PB.Pennant.hooks.afterGame.push((pen, m, game, r) => PP.onGame(pen, m, game, r));
    PB.Pennant.hooks.afterDay.push((pen, day) => PP.afterDay(pen, day));
  }

  /* ---------- 表示用の文 ---------- */
  PP.tagOf = function (pen, sid) {
    const s = PP.series(pen, sid);
    if (s) return s.tag;
    const d = DEF[pen.post && pen.post.rules === "cs" ? "cs" : "2004"][sid];
    return d ? d.tag : "ポストシーズン";
  };
  // その日の呼び名: 日本シリーズ第3戦 / CSファースト第2戦 / 表彰式
  PP.dayTag = function (pen, day) {
    if (day === pen.awardsDay) return "表彰式";
    const games = (pen.schedule[day] || []).filter((m) => m.ps);
    if (!games.length) return "";
    const tags = [...new Set(games.map((m) => PP.tagOf(pen, m.ps)))];
    const ns = [...new Set(games.map((m) => m.g))];
    const name = (t) => (t === "第1ステージ" || t === "第2ステージ" ? "プレーオフ" + t : t);
    return tags.length === 1 ? name(tags[0]) + (ns.length === 1 ? "第" + ns[0] + "戦" : "") : "クライマックスシリーズ";
  };
  function winsText(w, l, t) {
    return w + "勝" + l + "敗" + (t ? t + "分" : "");
  }
  // 系列の状況 (結果画面のボタン): 日本シリーズ 中日 2勝1敗 (自チームが出ていれば自チームから見て)
  PP.statusText = function (pen, sid) {
    const s = PP.series(pen, sid);
    if (!s || !s.hi || !s.lo) return "";
    const me = s.lo === pen.my ? 1 : 0;
    const id = me ? s.lo : s.hi;
    const txt = s.tag + " " + team(id).short + " " + winsText(s.w[me], s.w[1 - me], s.t);
    return s.win ? txt + (s.win === id ? "で" + celWord(s) : "で敗退") : txt;
  };
  function celWord(s) {
    if (s.id === "JS") return "日本一";
    if (s.cel === "lg") return "優勝";
    return "勝ち抜け";
  }
  // 自チームのポストシーズン (シーズン総括)
  PP.myResult = function (pen) {
    if (!pen.post || !pen.post.series) return "";
    const mine = pen.post.series.filter((s) => s.hi === pen.my || s.lo === pen.my);
    if (!mine.length) return pen.post.series.length ? "ポストシーズン進出ならず" : "";
    const s = mine[mine.length - 1];
    const me = s.lo === pen.my ? 1 : 0;
    const name = s.id === "JS" ? "日本シリーズ" : s.name;
    // まだ始まっていない系列 (日本シリーズ・第2ステージで相手を待っている)
    if (!s.games.length && !s.win) return (s.id === "JS" ? "日本シリーズ進出" : name + "から出場") + (s.hi && s.lo ? "" : "（相手を待っています）");
    if (!s.win) return name + " " + winsText(s.w[me], s.w[1 - me], s.t);
    return name + " " + winsText(s.w[me], s.w[1 - me], s.t) + (s.win === pen.my ? (s.id === "JS" ? "で日本一" : "で勝ち抜け") : "で敗退");
  };
  // 優勝球団の一覧 (シーズン総括)
  PP.champions = function (pen) {
    const st = { C: Pen().standings(pen, "C"), P: Pen().standings(pen, "P") };
    const rec = (lg, id) => {
      const x = st[lg].find((y) => y.id === id);
      return x ? winsText(x.w, x.l, x.d) : "";
    };
    const P = pen.post;
    const out = { lg: { C: st.C[0] ? st.C[0].id : null, P: st.P[0] ? st.P[0].id : null }, js: null, jsLine: "", rows: [] };
    if (!P || !P.series || !P.series.length) {
      out.rows.push({ label: "セ・リーグ優勝", id: out.lg.C, sub: rec("C", out.lg.C) });
      out.rows.push({ label: "パ・リーグ優勝", id: out.lg.P, sub: rec("P", out.lg.P) + (pen.opts && pen.opts.post === false ? "（ポストシーズンなし）" : "") });
      return out;
    }
    const js = PP.series(pen, "JS");
    const sline = (s) => (s && s.win ? winsText(s.w[s.win === s.hi ? 0 : 1], s.w[s.win === s.hi ? 1 : 0], s.t) + (s.adv ? "（アドバンテージ1勝を含む）" : "") : "");
    if (P.rules === "cs") {
      out.rows.push({ label: "セ・リーグ優勝", id: P.champs.C, sub: rec("C", P.champs.C) });
      out.rows.push({ label: "パ・リーグ優勝", id: P.champs.P, sub: rec("P", P.champs.P) });
      for (const lg of ["C", "P"]) out.rows.push({ label: LG_SHORT[lg] + " CS制覇", id: P.champs.cs[lg] || null, sub: sline(PP.series(pen, lg + "2")) });
    } else {
      out.lg.P = P.champs.P;
      out.rows.push({ label: "セ・リーグ優勝", id: P.champs.C, sub: rec("C", P.champs.C) });
      out.rows.push({ label: "パ・リーグ1位通過", id: P.champs.P1st, sub: rec("P", P.champs.P1st) });
      out.rows.push({ label: "パ・リーグ優勝", id: P.champs.P, sub: P.champs.P ? "プレーオフ " + sline(PP.series(pen, "P2")) : "" });
    }
    out.js = P.champs.JS || null;
    if (js && js.win) out.jsLine = "日本シリーズ " + sline(js) + "（vs " + team(js.lose).short + "）";
    out.rows.push({ label: "日本一", id: out.js, sub: js && js.win ? sline(js) : "", big: true });
    return out;
  };
  // 延長の上限 (表 R.post.extra。9 回制でないときは今までどおり +2 回)
  PP.maxInnings = function (pen, m) {
    const inn = pen.innings || 9;
    if (inn < 9) return inn + 2;
    if (m.ps === "JS") return m.g >= 8 ? P0.extra.js8 : P0.extra.js;
    return P0.extra.po;
  };
  function formatText(s) {
    if (s.id === "JS") return "7試合制・4勝で日本一（2-3-2）";
    return s.max + "試合制・" + s.need + "勝で勝ち抜け" + (s.adv ? "（アドバンテージ" + s.adv + "勝を含む）" : "");
  }
  function seedText(pen, s, side) {
    if (s.id === "JS") return side ? "パ・リーグ" : "セ・リーグ";
    const sd = s.seeds[side];
    if (sd) return sd + "位";
    return s.round === 2 ? (pen.post.rules === "cs" ? "ファースト勝者" : "第1ステージ勝者") : "";
  }
  function tbdText(pen, s, side) {
    if (s.id === "JS") return (side ? "パ・リーグ" : "セ・リーグ") + (pen.post.rules === "cs" ? " CSの勝者" : side ? " プレーオフの勝者" : "優勝球団");
    return (pen.post.rules === "cs" ? "ファーストステージ" : "第1ステージ") + "の勝者";
  }
  function advText(pen, s) {
    if (s.id === "JS" || s.round !== 2) return "";
    if (pen.post.rules === "cs") return team(s.hi).short + "に1勝のアドバンテージ（レギュラーシーズン1位・後年ルール）";
    const g = s.gap != null ? s.gap.toFixed(1) : "?";
    return s.adv ? team(s.hi).short + "に1勝のアドバンテージ（2位に" + g + "ゲーム差。5ゲーム差以上で適用）" : "アドバンテージなし（1位と2位のゲーム差 " + g + "。5ゲーム差以上で1位に1勝）";
  }
  PP.advText = advText;
  function resultText(pen, s) {
    if (!s.win) return "";
    const k = s.win === s.hi ? 0 : 1;
    return team(s.win).short + "が" + winsText(s.w[k], s.w[1 - k], s.t) + "で" + (s.id === "JS" ? "日本一" : s.cel === "lg" ? "優勝" : s.cel === "cs" ? "日本シリーズ進出" : "勝ち抜け");
  }
  PP.resultText = resultText;

  /* ---------- 画面の部品 ---------- */
  function gameChip(pen, s, g) {
    const tie = g.hs === g.as;
    const win = g.hs > g.as ? g.home : g.away;
    const ws = Math.max(g.hs, g.as);
    const ls = Math.min(g.hs, g.as);
    const cls = tie ? "d" : win === s.hi ? "a" : "b";
    return (
      '<span class="pp-g ' +
      cls +
      '"><i>' +
      g.n +
      "</i>" +
      (tie ? "△" : esc(abbr(win))) +
      ws +
      "-" +
      ls +
      (g.inn > (pen.innings || 9) ? "<small>延" + g.inn + "</small>" : "") +
      (g.wo ? "<small>サ</small>" : "") +
      "</span>"
    );
  }
  function cardHTML(pen, s) {
    const row = (side) => {
      const id = side ? s.lo : s.hi;
      if (!id) return '<div class="pp-t tbd"><span>' + esc(tbdText(pen, s, side)) + "</span></div>";
      const won = s.win === id;
      const out = s.win && !won;
      return (
        '<div class="pp-t' +
        (won ? " win" : out ? " out" : "") +
        (id === pen.my ? " me" : "") +
        '">' +
        UI.mark(team(id), 26) +
        "<b>" +
        esc(team(id).short) +
        '</b><span class="pp-seed">' +
        esc(seedText(pen, s, side)) +
        "</span>" +
        (side === 0 && s.adv ? '<i class="pp-adv" title="アドバンテージ">+' + s.adv + "</i>" : "") +
        '<span class="pp-w">' +
        (s.games.length || s.adv || s.win ? s.w[side] : "-") +
        "</span>" +
        (won ? '<i class="pp-wb">' + (s.id === "JS" ? "日本一" : s.cel === "lg" ? "優勝" : "突破") + "</i>" : "") +
        "</div>"
      );
    };
    const now = s.hi && s.lo && !s.win && s.games.length ? '<p class="pp-res now">' + esc(PP.statusText(pen, s.id)) + "</p>" : "";
    return (
      '<div class="pp-card' +
      (s.win ? " done" : s.hi && s.lo && s.games.length ? " live" : "") +
      (s.hi === pen.my || s.lo === pen.my ? " mine" : "") +
      (s.id === "JS" ? " js" : "") +
      '"><div class="pp-h"><b>' +
      esc(s.name) +
      "</b><small>" +
      esc(formatText(s)) +
      "</small></div>" +
      row(0) +
      row(1) +
      (s.games.length ? '<div class="pp-gs">' + s.games.map((g) => gameChip(pen, s, g)).join("") + "</div>" : "") +
      (s.win ? '<p class="pp-res">' + esc(resultText(pen, s)) + "</p>" : now) +
      "</div>"
    );
  }
  PP.cardHTML = cardHTML;
  // トーナメント表 (ステージ順)
  PP.bracketHTML = function (pen) {
    const P = pen.post;
    if (!P || !P.series) return "";
    const rounds = [...new Set(P.series.map((s) => s.round))].sort((a, b) => a - b);
    let html = '<div class="pp-bracket">';
    if (P.rules !== "cs" && P.champs.C)
      html +=
        '<div class="pp-card pp-cl"><div class="pp-h"><b>セ・リーグ</b><small>プレーオフなし（2004年）・レギュラーシーズン1位が優勝</small></div><div class="pp-t win' +
        (P.champs.C === pen.my ? " me" : "") +
        '">' +
        UI.mark(team(P.champs.C), 26) +
        "<b>" +
        esc(team(P.champs.C).short) +
        '</b><span class="pp-seed">1位</span><i class="pp-wb">優勝</i></div></div>';
    for (const r of rounds) html += P.series.filter((s) => s.round === r).map((s) => cardHTML(pen, s)).join("");
    return html + "</div>";
  };

  // 系列の MVP の行
  function mvpLine(pen, m, label) {
    if (!m) return "";
    return '<div class="pp-mvp" data-act="player" data-arg="' + esc(m.id) + '"><span class="pp-mvp-l">' + esc(label) + "</span>" + UI.mark(team(m.tid), 20) + "<b>" + esc(m.name) + "</b><small>" + esc(m.why || "") + "</small></div>";
  }
  PP.mvpLabel = function (pen, s, fight) {
    if (fight) return "日本シリーズ 敢闘選手";
    if (s.id === "JS") return "日本シリーズMVP";
    return (pen.post.rules === "cs" ? LG_SHORT[s.lg] + " CS" : "プレーオフ") + " MVP";
  };

  /* ---------- 画面: ポストシーズンのハブ ---------- */
  PP.hub = function () {
    const pen = Store.data.pennant;
    const P = pen.post;
    const N = Pen();
    if (pen.finished) return N.final();
    N.beginDay(pen);
    // まだ見せていない決着 (優勝・日本一) → 開幕の画面 (今日が第 1 戦の系列)
    if (P && P.series) {
      const cel = P.series.find((s) => s.win && s.cel && !P.cel[s.id]);
      if (cel) return PP.celebrate(cel.id);
      const intro = P.series.find((s) => s.start === pen.day && !P.seen[s.id] && !s.games.length);
      if (intro) return PP.intro(intro.id);
    }
    let busy = false;
    if (N.partialDay(pen)) {
      busy = true;
      setTimeout(() => {
        const ok = N._internal.finishDayAsync(pen, null, null, () => {
          busy = false;
          if (UI.cur && UI.cur.isPostHub) UI.go(N.hub());
        });
        if (!ok) busy = false;
      }, 30);
    }
    const dis = () => (busy ? " disabled" : "");
    const lgs = Object.keys(D.LEAGUES || {}).filter((k) => N.lgTeams(pen, k).length);
    return {
      isPostHub: true,
      isPenHub: true,
      html() {
        const day = pen.schedule[pen.day] || [];
        const awards = pen.day === pen.awardsDay;
        const tag = N.dayTag(pen, pen.day);
        const dated = N.dateOf(pen, pen.day) != null;
        let today = "";
        if (awards) {
          today =
            '<div class="pen-off pp-awday"><b>' +
            esc((pen.year || 2004) + "年 表彰式") +
            "</b><small>MVP・新人王・ベストナイン・ゴールデン・グラブ賞・沢村賞を発表します</small></div>" +
            '<div class="row-btns"><button class="btn red big" data-act="awards"' +
            dis() +
            ">表彰式へ</button></div>";
        } else {
          const recorded = new Set(pen.results.filter((r) => r.day === pen.day).map((r) => r.gi));
          day.forEach((m, gi) => {
            if (recorded.has(gi)) return;
            const s = PP.series(pen, m.ps);
            if (!s) return;
            const mine = m.home === pen.my || m.away === pen.my;
            const side = (id) => (id === s.hi ? 0 : 1);
            const tcol = (id) =>
              '<div class="mc-team">' +
              UI.mark(team(id), 40) +
              "<b>" +
              esc(team(id).short) +
              "</b><small>" +
              s.w[side(id)] +
              "勝" +
              (id === s.hi && s.adv ? "（+" + s.adv + "含む）" : "") +
              "<br>先発 " +
              esc((D.player(team(id), N.nextStarter(team(id), pen)) || { name: "-" }).name) +
              "</small></div>";
            today +=
              '<div class="pp-today' +
              (mine ? " mine" : "") +
              '"><p class="pp-gl"><b>' +
              esc(s.name) +
              "</b>第" +
              m.g +
              "戦</p>" +
              '<div class="matchcard">' +
              tcol(m.away) +
              '<div class="mc-vs">VS<small>' +
              esc(team(m.home).stadium || "") +
              "</small></div>" +
              tcol(m.home) +
              "</div>" +
              (mine
                ? '<div class="row-btns"><button class="btn red big" data-act="play" data-arg="' +
                  gi +
                  '"' +
                  dis() +
                  '>試合開始</button></div><div class="row-btns"><button class="btn" data-act="sim"' +
                  dis() +
                  ">この試合をおまかせ</button></div>"
                : '<div class="row-btns"><button class="btn primary" data-act="watch" data-arg="' + gi + '"' + dis() + '>観戦</button><button class="btn" data-act="sim"' + dis() + ">おまかせ</button></div>") +
              "</div>";
          });
          const ids = day.map((m) => m.ps).filter((x, i, a) => x && a.indexOf(x) === i && !(PP.series(pen, x) || {}).win);
          if (ids.length) today += '<div class="row-btns"><button class="btn" data-act="simser"' + dis() + ">シリーズを最後までおまかせ</button></div>";
        }
        const mvps = P && P.series ? P.series.filter((s) => P.mvp && P.mvp[s.id]).map((s) => mvpLine(pen, P.mvp[s.id], PP.mvpLabel(pen, s)) + (s.id === "JS" ? mvpLine(pen, P.mvp.JSf, PP.mvpLabel(pen, s, true)) : "")) : [];
        return (
          UI.header("ポストシーズン", "back") +
          '<div class="scr-body pp-hub">' +
          '<div class="pen-top"><div class="pen-date"><b>' +
          esc(dated ? N.dayLabel(pen, pen.day) : tag || N.dayLabel(pen, pen.day)) +
          "</b><span>" +
          esc(dated ? tag : (pen.year || 2004) + "年 ポストシーズン") +
          '</span></div><div class="pen-rank pp-my">' +
          esc(PP.myResult(pen) || "") +
          "</div></div>" +
          today +
          (busy ? '<p class="note center">試合を消化しています…</p>' : "") +
          (PB.News ? PB.News.hubPanel(pen) : "") +
          '<h3 class="lbl">トーナメント表</h3>' +
          PP.bracketHTML(pen) +
          (mvps.length ? '<div class="pp-mvps">' + mvps.join("") + "</div>" : "") +
          (pen.post && pen.post.series ? '<p class="note small">延長はプレーオフ' + P0.extra.po + "回・日本シリーズ" + P0.extra.js + "回まで（第8戦以降は制限なし）。日程・延長回数はゲームの設定です（要確認）。</p>" : "") +
          '<details class="box-det"><summary>レギュラーシーズン最終順位</summary>' +
          lgs.map((k) => '<h3 class="lbl">' + esc(D.LEAGUES[k]) + "</h3>" + N.standingsHTML(pen, N.standings(pen, k))).join("") +
          "</details>" +
          '<div class="row-btns"><button class="btn" data-act="order">オーダー</button><button class="btn" data-act="leaders">個人成績</button><button class="btn" data-act="results">試合結果</button></div>' +
          '<div class="row-btns">' +
          (pen.awards && pen.awards.titles ? '<button class="btn" data-act="titles">タイトル・表彰</button>' : "") +
          (PB.News && pen.results.length ? '<button class="btn" data-act="news" data-arg="news">スポーツニュース</button>' : "") +
          "</div>" +
          '<div class="row-btns"><button class="btn ghost" data-act="abandon">シーズンをやめる</button></div>' +
          "</div>"
        );
      },
      onAct(act, arg) {
        if (busy || N.busy()) return;
        if (act === "back") return UI.go(Sc.title());
        if (act === "player") return UI.showPlayer(arg, null);
        if (act === "order") return UI.go(Sc.order(N.team(pen.my), { onBack: () => UI.go(N.hub()) }));
        if (act === "leaders") return UI.go(N.leaders());
        if (act === "results") return UI.go(N.results());
        if (act === "titles" && PB.PenAwards) return UI.go(PB.PenAwards.screen({ onBack: () => N.hub() }));
        if (act === "news") return UI.go(PB.News.screen({ tab: arg || "news" }));
        if (act === "abandon")
          return UI.confirm(
            "シーズンを終了します。成績は消えます。よろしいですか？",
            () => {
              Store.data.pennant = null;
              Store.save();
              UI.go(Sc.title());
            },
            { yes: "終了する", danger: true }
          );
        if (act === "awards") {
          // 表彰式の日を閉じる (ニュースを作ってシーズン終了)
          N._internal.finishDay(pen, null);
          return UI.go(PB.PenAwards ? PB.PenAwards.screen({ ceremony: true, onBack: () => N.final() }) : N.final());
        }
        if (act === "play" || act === "watch") {
          const gi = Number(arg);
          const m = (pen.schedule[pen.day] || [])[gi];
          if (!m) return;
          const user = act === "play" ? (m.home === pen.my ? "home" : m.away === pen.my ? "away" : null) : null;
          return N.playLive(pen, m, gi, user);
        }
        if (act === "sim") {
          busy = true;
          UI.refresh();
          setTimeout(() => {
            let g = null;
            const m = N.myMatch(pen);
            if (m) {
              g = N._internal.makeGame(pen, m, null);
              g.simToEnd();
            }
            const ok = N._internal.finishDayAsync(pen, g, null, () => {
              busy = false;
              UI.go(N.hub());
            });
            if (!ok) {
              busy = false;
              UI.refresh();
            }
          }, 60);
          return;
        }
        if (act === "simser") {
          const ids = (pen.schedule[pen.day] || []).map((m) => m.ps).filter((x, i, a) => x && a.indexOf(x) === i);
          const mine = ids.some((id) => {
            const s = PP.series(pen, id);
            return s && (s.hi === pen.my || s.lo === pen.my);
          });
          const go = () => UI.go(PP.simSeries(ids));
          if (mine) return UI.confirm("自分のチームの試合もおまかせでシリーズの最後まで進めます。よろしいですか？", go, { yes: "進める" });
          return go();
        }
      },
    };
  };

  /* ---------- 画面: シリーズを最後までおまかせ (進行表示) ---------- */
  PP.simSeries = function (ids) {
    const pen = Store.data.pennant;
    const N = Pen();
    const st = { ctl: null, cancel: false, root: null };
    const box = () => ids.map((id) => PP.series(pen, id)).filter(Boolean).map((s) => cardHTML(pen, s)).join("");
    const scr = {
      isPenSim: true,
      cls: "pen-simscr",
      html() {
        return (
          '<div class="scr-body pen-simv pp-simv"><p class="pen-simv-k">シリーズを最後まで進めています</p><p class="pen-simv-date">' +
          esc(N.dayLabel(pen, pen.day)) +
          '</p><div class="pp-bracket pp-simbox">' +
          box() +
          '</div><button class="btn" data-act="cancel"' +
          (st.cancel ? " disabled" : "") +
          ">" +
          (st.cancel ? "この日の試合を終えたら止めます…" : "中断") +
          "</button></div>"
        );
      },
      mount(root) {
        st.root = root;
      },
      update() {
        const r = st.root;
        if (!r || !r.querySelector) return;
        const b = r.querySelector(".pp-simbox");
        if (b) b.innerHTML = box();
        const d = r.querySelector(".pen-simv-date");
        if (d) d.textContent = N.dayLabel(pen, Math.min(pen.day, pen.schedule.length - 1));
      },
      onAct(act) {
        if (act === "cancel" && st.ctl && !st.cancel) {
          st.ctl.stop = true;
          st.cancel = true;
          UI.refresh();
        }
      },
    };
    const stop = (p) => p.finished || p.day === p.awardsDay || ids.every((id) => (PP.series(p, id) || { win: 1 }).win);
    setTimeout(() => {
      st.ctl = N.simUntil(
        pen,
        stop,
        () => {
          if (UI.cur === scr) scr.update();
        },
        () => {
          if (UI.cur === scr) UI.go(N.hub());
        }
      );
    }, 40);
    return scr;
  };

  /* ---------- 画面: 系列の開幕 ---------- */
  PP.intro = function (sid) {
    const pen = Store.data.pennant;
    const s = PP.series(pen, sid);
    const N = Pen();
    const y = yearOf(pen);
    const recOf = (id) => {
      const lg = N.lgOf(id);
      const x = N.standings(pen, lg).find((z) => z.id === id);
      return x ? winsText(x.w, x.l, x.d) : "";
    };
    const tcol = (side) => {
      const id = side ? s.lo : s.hi;
      return (
        '<div class="pp-vs-t' +
        (id === pen.my ? " me" : "") +
        '">' +
        UI.mark(team(id), 72) +
        "<b>" +
        esc(team(id).short) +
        "</b><small>" +
        esc(seedText(pen, s, side) + " " + recOf(id)) +
        "</small>" +
        (side === 0 && s.adv ? '<i class="pp-adv">アドバンテージ +' + s.adv + "勝</i>" : "") +
        "</div>"
      );
    };
    const rules = [formatText(s)];
    if (s.id === "JS") {
      const first = PP.firstHost(s, y);
      const other = first === s.hi ? s.lo : s.hi;
      rules.push("第1・2・6・7戦 " + team(first).short + "（" + (team(first).stadium || "") + "）、第3〜5戦 " + team(other).short + "（" + (team(other).stadium || "") + "）。" + (y % 2 === 0 ? "偶数年はセ・リーグの球団が第1戦を主催" : "奇数年はパ・リーグの球団が第1戦を主催"));
      rules.push("DH制はパ・リーグの本拠地の試合だけ");
      rules.push("引き分けがあれば第8戦以降も4勝するまで行う");
      rules.push("延長は" + P0.extra.js + "回まで・第8戦以降は制限なし（要確認・ゲームの設定）");
    } else {
      rules.push("全試合 " + team(s.hi).short + "の本拠地（" + (team(s.hi).stadium || "") + "）");
      const a = advText(pen, s);
      if (a) rules.push(a);
      rules.push("引き分けを含み" + s.max + "試合で決着しないときは上位の球団が勝ち抜け（結果が変わらなくなった時点で終了・ゲームの設定）");
      rules.push("延長は" + P0.extra.po + "回まで（要確認・ゲームの設定）");
    }
    if ((pen.innings || 9) < 9) rules.push((pen.innings || 9) + "回制の試合は延長" + ((pen.innings || 9) + 2) + "回まで");
    return {
      cls: "result",
      html() {
        return (
          '<div class="scr-body res-body pp-intro"><div class="res-head"><p class="walkoff">' +
          esc(y + "年 " + s.group) +
          "</p><h2>" +
          esc(s.stage) +
          "</h2></div>" +
          '<div class="pp-vs">' +
          tcol(0) +
          '<span class="pp-vs-x">VS</span>' +
          tcol(1) +
          "</div>" +
          '<ul class="pp-rules">' +
          rules.map((t) => "<li>" + esc(t) + "</li>").join("") +
          "</ul>" +
          '<div class="row-btns"><button class="btn red big" data-act="go">シリーズ開始</button></div></div>'
        );
      },
      onAct(act) {
        if (act === "go") {
          pen.post.seen[sid] = 1;
          Store.save();
          UI.go(Pen().hub());
        }
      },
    };
  };

  /* ---------- 画面: 決着 (優勝・日本一) ---------- */
  function confettiHTML() {
    const cols = ["#ffcf4a", "#e2372f", "#3ddc84", "#4cc6e6", "#ffffff", "#ff8a80"];
    let h = "";
    for (let i = 0; i < 28; i++) {
      const x = (i * 37) % 100;
      const d = ((i * 53) % 17) / 10;
      const dur = 2.6 + ((i * 29) % 13) / 10;
      h += '<i style="--x:' + x + "%;--d:" + d.toFixed(1) + "s;--t:" + dur.toFixed(1) + "s;--c:" + cols[i % cols.length] + ";--r:" + ((i * 47) % 360) + 'deg"></i>';
    }
    return '<div class="pp-confetti" aria-hidden="true">' + h + "</div>";
  }
  PP.celebrate = function (sid) {
    const pen = Store.data.pennant;
    const s = PP.series(pen, sid);
    const N = Pen();
    const y = yearOf(pen);
    const win = team(s.win);
    const mine = s.win === pen.my;
    const k = s.win === s.hi ? 0 : 1;
    const word = s.id === "JS" ? "日本一" : s.cel === "lg" ? "優勝" : "CS制覇";
    const head = mine ? word + "！！" : win.short + " " + word;
    const sub = s.id === "JS" ? "日本シリーズ " : s.cel === "lg" ? LG_SHORT.P + "（プレーオフ制覇）" : LG_SHORT[s.lg] + "（日本シリーズ進出）";
    const mvp = pen.post.mvp && pen.post.mvp[sid];
    // 自チームが敗れた系列は残念な音、それ以外は祝福
    const A = PB.Audio;
    setTimeout(() => A && (s.lose === pen.my ? A.lose && A.lose() : A.victory && A.victory()), 200);
    return {
      cls: "result",
      html() {
        return (
          '<div class="scr-body res-body pp-cel">' +
          confettiHTML() +
          '<div class="res-head win"><p class="walkoff">' +
          esc(y + "年 " + s.name) +
          "</p><h2>" +
          esc(head) +
          "</h2>" +
          UI.mark(win, 80) +
          '<p class="pp-cel-r">' +
          esc(sub + winsText(s.w[k], s.w[1 - k], s.t) + (s.adv && k === 0 ? "（アドバンテージ1勝を含む）" : "") + "　vs " + team(s.lose).short) +
          "</p></div>" +
          (mvp
            ? '<div class="mvp' +
              (PB.Cards ? ' has-card"><div class="mvp-pc"></div>' : '">') +
              '<div><span class="mvp-l">' +
              esc(PP.mvpLabel(pen, s)) +
              "</span><b>" +
              esc(mvp.name) +
              "</b><small>" +
              esc(team(mvp.tid).short + "・" + (mvp.why || "")) +
              "</small></div></div>"
            : "") +
          (s.id === "JS" && pen.post.mvp.JSf ? mvpLine(pen, pen.post.mvp.JSf, "敢闘選手") : "") +
          '<div class="row-btns"><button class="btn primary" data-act="next">次へ</button></div></div>'
        );
      },
      mount(root) {
        const slot = root.querySelector && root.querySelector(".mvp-pc");
        if (slot && mvp && PB.Cards) {
          const f = N.findPlayer(mvp.id);
          if (f) slot.appendChild(PB.Cards.el(f.p, f.team, { w: Math.min(132, Math.round(window.innerWidth * 0.34)) }));
        }
      },
      onAct(act, arg) {
        if (act === "player") return UI.showPlayer(arg, null);
        if (act === "next") {
          pen.post.cel[sid] = 1;
          Store.save();
          UI.go(N.hub());
        }
      },
    };
  };

  /* ---------- 画面: トーナメント表だけ (シーズン総括から) ---------- */
  PP.bracketScreen = function (o) {
    const pen = Store.data.pennant;
    const P = pen.post;
    return {
      html() {
        const mvps = P && P.series ? P.series.filter((s) => P.mvp && P.mvp[s.id]).map((s) => mvpLine(pen, P.mvp[s.id], PP.mvpLabel(pen, s)) + (s.id === "JS" ? mvpLine(pen, P.mvp.JSf, PP.mvpLabel(pen, s, true)) : "")) : [];
        return UI.header((pen.year || 2004) + "年 ポストシーズン", "back") + '<div class="scr-body">' + PP.bracketHTML(pen) + (mvps.length ? '<div class="pp-mvps">' + mvps.join("") + "</div>" : "") + "</div>";
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(o && o.onBack ? o.onBack() : Pen().hub());
        if (act === "player") UI.showPlayer(arg, null);
      },
    };
  };

  PB.PenPost = PP;
})((window.PB = window.PB || {}));
