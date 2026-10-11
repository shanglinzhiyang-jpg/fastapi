/* 熱闘！ポケットベースボール — スポーツニュース (ペナント)
   試合で実際に起きた出来事・確定した数字だけから記事を作る (同じ日を二度数えない)。
   目玉は「今日のホームラン」: その日の全試合 (セ・パ) の本塁打を中継風に紹介する。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const esc = U.esc;
  const News = {};

  const MAX_NEWS = 400;
  const MAX_HR_ITEMS = 4; // 1 日に載せる本塁打記事の上限
  const CIRCLED = ["", "①", "②", "③", "④"];
  const LG_SHORT = { C: "セ・リーグ", P: "パ・リーグ" };
  const PROGRAM = "熱闘スポーツ";

  /* ---------- 小物 ---------- */
  function store() {
    return PB.Store;
  }
  function team(id) {
    return store().team(id) || { id, short: "?", name: "?", players: [] };
  }
  function teamDef(id) {
    return D.teamDef ? D.teamDef(id) : null;
  }
  function teamAbbr(id) {
    const d = teamDef(id);
    const t = team(id);
    return (d && d.abbr) || t.abbr || String(t.short || "?").slice(0, 1);
  }
  function lgOf(id) {
    return PB.Pennant && PB.Pennant.lgOf ? PB.Pennant.lgOf(id) : "C";
  }
  // 選手 ID → 選手 (登録・抹消があっても古い名前が出ないよう毎回作り直す)
  function playerMap() {
    const m = {};
    for (const t of store().teams()) for (const p of t.players) m[p.id] = p;
    return m;
  }
  let pm = null;
  function player(id) {
    if (!pm) {
      pm = playerMap();
      setTimeout(() => (pm = null), 0);
    }
    return pm[id] || { id, name: "?" };
  }
  News.player = player;
  // 本塁打の記録に残した名前を優先 (後で選手が入れ替わっても当時の名前)
  function batName(e) {
    return e.nm || player(e.id).name;
  }
  function pitName(e) {
    return e.pn || player(e.pid).name;
  }
  function hrTeam(r, e) {
    return e.tid || (e.side === "home" ? r.home : r.away);
  }
  function oppTeam(r, e) {
    return e.side === "home" ? r.away : r.home;
  }
  function kindShort(e) {
    if (e.type === "IPHR") return "ランニング";
    return e.n >= 4 ? "満塁" : e.n === 1 ? "ソロ" : e.n + "ラン";
  }
  function kindCap(e) {
    if (e.type === "IPHR") return "ランニング本塁打";
    return e.n >= 4 ? "満塁弾" : kindShort(e);
  }
  function dirText(e, long) {
    if (e.type === "IPHR") return "ランニング本塁打";
    if (e.dir === "左") return long ? "レフトスタンド" : "レフト";
    if (e.dir === "右") return long ? "ライトスタンド" : "ライト";
    return long ? "バックスクリーン方向" : "センター";
  }
  function innText(e) {
    return e.inn + "回" + (e.top ? "表" : "裏");
  }
  // 見出し: 鳥谷 4号先制2ラン
  function caption(e) {
    return batName(e) + " " + (e.no ? e.no + "号" : "") + (e.ctx || "") + kindCap(e);
  }
  News.caption = caption;

  // 本塁打につくタグ (確定した事実だけ・優先順)
  function hrTags(e) {
    const t = [];
    const push = (text, cls) => t.push({ text, cls: cls || "" });
    if (e.ctx === "サヨナラ") push("サヨナラ", "hot");
    if (e.n >= 4) push("満塁", "hot");
    if (e.ctx === "逆転") push("逆転", "hot");
    if (e.ph) push("代打");
    if (e.lead) push("先頭打者");
    if (e.game >= 2) push("1試合" + e.game + "本目");
    if (e.consec >= 2) push(e.consec + "打席連続");
    if (e.b2b >= 2) push(e.b2b + "者連続");
    if (e.ctx === "同点") push("同点");
    if (e.ctx === "勝ち越し") push("勝ち越し");
    if (e.ctx === "先制") push("先制");
    if (e.extra) push("延長" + e.inn + "回");
    if (e.gs >= 2) push(e.gs + "試合連続");
    if (e.both) push("両打席");
    if (e.open) push("開幕戦");
    if (e.no === 1) push("今季1号", "gold");
    if (e.no >= 10 && e.no % 10 === 0) push(e.no + "号到達", "gold");
    return t;
  }
  News.hrTags = (e) => hrTags(e).map((x) => x.text);
  function chipsHTML(e, max) {
    const t = hrTags(e);
    if (!t.length) return "";
    const shown = max ? t.slice(0, max) : t;
    return (
      '<div class="nhr-tags">' +
      shown.map((x) => '<i class="' + x.cls + '">' + esc(x.text) + "</i>").join("") +
      (t.length > shown.length ? '<i class="more">+' + (t.length - shown.length) + "</i>" : "") +
      "</div>"
    );
  }
  // 新聞の本塁打欄: 鳥谷4号②(上原)
  function hrLine(e) {
    return esc(batName(e)) + (e.no ? e.no + "号" : "") + (e.type === "IPHR" ? "(走)" : CIRCLED[Math.min(4, e.n)]) + "(" + esc(pitName(e)) + ")";
  }
  News.hrLine = hrLine;

  function dayResults(pen, day) {
    return pen.results.filter((r) => r.day === day).sort((a, b) => (a.gi || 0) - (b.gi || 0));
  }
  News.dayResults = dayResults;
  function dayHRs(pen, day) {
    const out = [];
    for (const r of dayResults(pen, day)) (r.hr || []).forEach((e, k) => out.push({ e, r, k }));
    return out;
  }
  News.dayHRs = dayHRs;
  // その日の本塁打記録の状態: none = 0 本 / nodata = 記録開始前 / empty = 試合なし / ok
  function dayStatus(pen, day) {
    const rs = dayResults(pen, day);
    if (!rs.length) return "empty";
    if (rs.some((r) => !Array.isArray(r.hr))) return "nodata";
    return rs.some((r) => r.hr.length) ? "ok" : "none";
  }
  News.dayStatus = dayStatus;

  /* ---------- 記事の生成 (1 日ぶん・何度呼んでも同じ) ---------- */
  function add(pen, item) {
    pen.news = pen.news || [];
    if (item.key && pen.news.some((n) => n.key === item.key)) return;
    pen.news.push(item);
    if (pen.news.length > MAX_NEWS) pen.news.splice(0, pen.news.length - MAX_NEWS);
  }

  // 本塁打 1 本の記事候補 (優先度の高いものから 1 つ)
  function hrHeadline(e) {
    const nm = batName(e);
    const no = e.no ? "（" + e.no + "号）" : "";
    if (e.ctx === "サヨナラ") return { prio: 90, title: nm + "、サヨナラ" + (e.n === 1 && e.type !== "IPHR" ? "本塁打" : kindCap(e)) + "！" };
    if (e.game >= 3) return { prio: 80, title: nm + "、1試合" + e.game + "本塁打の大暴れ" };
    if (e.n >= 4) return { prio: 70, title: nm + "が" + (e.ctx ? e.ctx + "の" : "") + "満塁本塁打" + no };
    if (e.consec >= 3) return { prio: 70, title: nm + "、" + e.consec + "打席連続本塁打" };
    if (e.game === 2) return { prio: 55, title: nm + "、1試合2本塁打" + no };
    if (e.consec === 2) return { prio: 50, title: nm + "、2打席連続本塁打" };
    if (e.gs >= 3) return { prio: 50, title: nm + "、" + e.gs + "試合連続本塁打" + no };
    if (e.ph) return { prio: 45, title: e.ctx ? "代打・" + nm + "、" + e.ctx + kindShort(e) : "代打・" + nm + "が" + kindShort(e) };
    if (e.lead) return { prio: 45, title: nm + "、初回先頭打者本塁打" + no };
    if (e.extra) return { prio: 45, title: nm + "、延長" + e.inn + "回に" + (e.ctx || "") + kindShort(e) };
    if (e.both) return { prio: 45, title: nm + "、両打席本塁打" };
    if (e.no >= 10 && e.no % 10 === 0) return { prio: 40, title: nm + "、シーズン" + e.no + "号に到達" };
    if (e.ctx === "逆転") return { prio: 35, title: nm + "、逆転" + kindShort(e) };
    return null;
  }
  function hrBody(e) {
    if (e.type === "IPHR") return innText(e) + "、" + pitName(e) + "からランニング本塁打";
    return innText(e) + "、" + pitName(e) + "から" + (e.dist ? "推定" + e.dist + "mの" : "") + kindShort(e);
  }

  function streakOf(pen, id) {
    let n = 0;
    let kind = null;
    for (let i = pen.results.length - 1; i >= 0; i--) {
      const r = pen.results[i];
      if (r.home !== id && r.away !== id) continue;
      const my = r.home === id ? r.hs : r.as;
      const op = r.home === id ? r.as : r.hs;
      const k = my > op ? "w" : my < op ? "l" : "d";
      if (k === "d") break;
      if (!kind) kind = k;
      if (k !== kind) break;
      n++;
    }
    return { kind, n };
  }

  // リーグの本塁打ランキング (同数は同順位)。day を渡すとその日の終わり時点 (本塁打の号数から数える)
  function hrRanking(pen, lg, n, day) {
    const rows = [];
    if (day != null && day < lastPlayedDay(pen)) {
      const best = {};
      for (const r of pen.results) {
        if (r.day > day || lgOf(r.home) !== lg) continue;
        for (const e of r.hr || []) {
          const tid = hrTeam(r, e);
          const b = best[e.id] || (best[e.id] = { id: e.id, tid, name: batName(e), hr: 0 });
          b.hr = Math.max(b.hr, e.no || 0);
        }
      }
      for (const id in best) if (best[id].hr) rows.push(best[id]);
    } else
      for (const t of PB.Pennant.lgTeams(pen, lg))
        for (const p of t.players) {
          const s = pen.stats[p.id];
          if (s && s.hr) rows.push({ id: p.id, tid: t.id, name: p.name, hr: s.hr });
        }
    rows.sort((a, b) => b.hr - a.hr);
    let rank = 0;
    let last = -1;
    rows.forEach((x, i) => {
      if (x.hr !== last) rank = i + 1;
      last = x.hr;
      x.rank = rank;
    });
    return n ? rows.filter((x) => x.rank <= n) : rows;
  }
  News.hrRanking = hrRanking;
  // 表示用: 同順位が多いときは maxRows 行まで出して残りを「ほか N 人」にまとめる
  function rankRows(pen, lg, n, maxRows, day) {
    const rows = hrRanking(pen, lg, n, day);
    return { rows: rows.slice(0, maxRows), more: Math.max(0, rows.length - maxRows) };
  }

  News.generate = function (pen, day) {
    const Pen = PB.Pennant;
    pen.news = pen.news || [];
    pen.newsState = pen.newsState || { top: {}, hrTop: {}, done: {} };
    const ns = pen.newsState;
    ns.done = ns.done || {};
    ns.top = ns.top || {};
    ns.hrTop = ns.hrTop || {};
    if (ns.done[day]) return;
    const rs = dayResults(pen, day);
    // 1) 自チームの試合
    const mine = rs.find((r) => r.home === pen.my || r.away === pen.my);
    if (mine) {
      const isHome = mine.home === pen.my;
      const ms = isHome ? mine.hs : mine.as;
      const os = isHome ? mine.as : mine.hs;
      const me = team(pen.my);
      const op = team(isHome ? mine.away : mine.home);
      const mySide = isHome ? "home" : "away";
      const myHR = (mine.hr || []).filter((e) => e.side === mySide);
      const score = (e) => ((hrHeadline(e) || { prio: 0 }).prio * 10 + e.n) * 100 - e.inn;
      const key = myHR.slice().sort((a, b) => score(b) - score(a))[0];
      let title;
      if (ms > os) title = me.short + "、" + (mine.wo ? op.short + "にサヨナラ勝ち" : op.short + "に" + ms + "-" + os + "で勝利");
      else if (ms < os) title = me.short + "、" + (mine.wo ? op.short + "にサヨナラ負け" : op.short + "に" + ms + "-" + os + "で敗れる");
      else title = me.short + "、" + op.short + "と" + ms + "-" + os + "で引き分け";
      const body = [];
      if (key) body.push(batName(key) + "が" + innText(key) + "に" + (key.ctx || "") + kindShort(key) + (key.no ? "（" + key.no + "号）" : ""));
      const wl = [];
      if (mine.W) wl.push("勝 " + player(mine.W).name);
      if (mine.L) wl.push("敗 " + player(mine.L).name);
      if (mine.S) wl.push("S " + player(mine.S).name);
      if (wl.length) body.push(wl.join("、"));
      const sk = streakOf(pen, pen.my);
      if (sk.n >= 3) body.push(sk.n + (sk.kind === "w" ? "連勝" : "連敗"));
      add(pen, { key: "game:" + day, day, kind: "game", team: pen.my, prio: 100, title, body: body.join("。") });
    }
    // 2) 今日のホームランのまとめ
    const all = dayHRs(pen, day);
    if (all.length) {
      const lgs = new Set(all.map((x) => lgOf(x.r.home)));
      const longest = all.filter((x) => x.e.dist).sort((a, b) => b.e.dist - a.e.dist)[0];
      // 1 試合複数本は選手ごとに最多の本数で 1 行 (最初に打った順)
      const multi = new Map();
      for (const x of all) {
        const k = x.e.id;
        const cur = multi.get(k);
        if (!cur) multi.set(k, { e: x.e, n: x.e.game || 1 });
        else cur.n = Math.max(cur.n, x.e.game || 1);
      }
      const body = [];
      if (longest) body.push("最長は" + batName(longest.e) + "（" + teamAbbr(hrTeam(longest.r, longest.e)) + "）の推定" + longest.e.dist + "m");
      for (const { e, n } of multi.values()) if (n >= 2) body.push(batName(e) + "が1試合" + n + "本");
      add(pen, { key: "hrday:" + day, day, kind: "hrday", prio: 50, title: "今日のホームラン　" + (lgs.size > 1 ? "セ・パ計" : "計") + all.length + "本", body: body.join("。") });
    }
    // 3) 本塁打の話題 (全試合・1 人 1 本まで・最大 4 本)
    const cands = [];
    const hrRuns = {};
    for (const { e, r, k } of all) {
      const h = hrHeadline(e);
      const tid = hrTeam(r, e);
      if (h) cands.push({ key: "hr:" + day + ":" + (r.gi || 0) + ":" + k, day, kind: "hr", team: tid, pid: e.id, prio: h.prio + (tid === pen.my ? 15 : 0), title: h.title, body: hrBody(e), ord: (r.gi || 0) * 1000 + e.inn * 10 + k });
      // N者連続 (同じ回の続いた本塁打をまとめる)
      if (e.b2b >= 2) {
        const rk = (r.gi || 0) + ":" + e.inn + (e.top ? "t" : "b");
        const run = hrRuns[rk] || (hrRuns[rk] = { r, e, names: [] });
        run.last = e;
      }
    }
    for (const rk in hrRuns) {
      const run = hrRuns[rk];
      const e = run.last;
      const k = e.b2b;
      // 連続の先頭からの打者名 (同じ半イニングの最後の k 本)
      const same = (run.r.hr || []).filter((x) => x.inn === e.inn && x.top === e.top);
      const idx = same.indexOf(e);
      const names = same.slice(Math.max(0, idx - k + 1), idx + 1).map(batName);
      const tid = hrTeam(run.r, e);
      cands.push({
        key: "hrrun:" + day + ":" + rk,
        day,
        kind: "hrrun",
        team: tid,
        pid: e.id,
        prio: (k >= 3 ? 65 : 35) + (tid === pen.my ? 15 : 0),
        title: k >= 3 ? team(tid).short + "、" + k + "者連続本塁打" : names.join("・") + "が2者連続本塁打",
        body: innText(e) + "、" + names.join("・") + "が続いた",
        ord: (run.r.gi || 0) * 1000 + e.inn * 10,
      });
    }
    cands.sort((a, b) => b.prio - a.prio || a.ord - b.ord);
    const used = new Set();
    let nItems = 0;
    for (const c of cands) {
      if (nItems >= MAX_HR_ITEMS) break;
      if (c.kind === "hr" && used.has(c.pid)) continue;
      used.add(c.pid);
      delete c.ord;
      add(pen, c);
      nItems++;
    }
    // 4) 本塁打王争い・首位争い (リーグごと)
    for (const lg of Object.keys(D.LEAGUES || { C: 1 })) {
      if (!Pen.lgTeams(pen, lg).length) continue;
      const top = hrRanking(pen, lg).filter((x) => x.rank === 1);
      const ids = top.map((x) => x.id);
      const hr = top.length ? top[0].hr : 0;
      const prev = ns.hrTop[lg] || { ids: [], hr: 0 };
      const same = ids.length === prev.ids.length && ids.every((x) => prev.ids.indexOf(x) >= 0);
      if (hr >= 3 && !same) {
        const names = top.map((x) => x.name);
        const title = ids.length === 1 ? "本塁打王争い、" + names[0] + "が" + hr + "本で単独トップ" : "本塁打王争い、" + names.slice(0, 3).join("・") + (names.length > 3 ? "ら" : "") + "が" + hr + "本で並ぶ";
        add(pen, { key: "lead:" + day + ":" + lg, day, kind: "lead", lg, prio: 30, title, body: LG_SHORT[lg] || "" });
      }
      ns.hrTop[lg] = { ids, hr };
      const st = Pen.standings(pen, lg);
      const first = st[0];
      // 単独首位になったときだけ (勝率で並んでいるときは出さない)
      const alone = first && (!st[1] || st[1].gb > 0);
      if (first && alone && ns.top[lg] && ns.top[lg] !== first.id && first.g > 0) {
        add(pen, { key: "stand:" + day + ":" + lg, day, kind: "stand", lg, team: first.id, prio: 60, title: team(first.id).short + "が首位に浮上", body: (LG_SHORT[lg] || "") + " " + first.w + "勝" + first.l + "敗" + (first.d ? first.d + "分" : "") });
      }
      if (first && alone) ns.top[lg] = first.id;
    }
    ns.done[day] = 1;
  };

  /* ---------- 画面 ---------- */
  // 本塁打 1 本ぶんの行 (中継の「今日のホームラン」)
  function hrRow(e, r, i) {
    const tid = hrTeam(r, e);
    const t = team(tid);
    const def = teamDef(tid);
    const c = (def && def.main) || t.main || "#334";
    const sc = e.score || { away: r.as, home: r.hs };
    const kcls = e.ctx === "サヨナラ" ? " wo" : e.n >= 4 ? " gs" : "";
    const opp = oppTeam(r, e);
    return (
      '<div class="nhr" data-act="player" data-arg="' +
      esc(e.id) +
      '" aria-label="' +
      esc(caption(e)) +
      '" style="--tc:' +
      c +
      ";animation-delay:" +
      Math.min(i, 12) * 0.04 +
      's">' +
      '<div class="nhr-logo">' +
      PB.UI.mark(t, 34) +
      "</div>" +
      '<div class="nhr-main"><div class="nhr-top"><b class="nhr-nm">' +
      esc(batName(e)) +
      "</b>" +
      (e.no ? '<span class="nhr-no">' + e.no + "<small>号</small></span>" : "") +
      '<span class="nhr-kind' +
      kcls +
      '">' +
      kindShort(e) +
      "</span></div>" +
      '<div class="nhr-sub">' +
      innText(e) +
      "・投手 " +
      esc(pitName(e)) +
      "（" +
      esc(teamAbbr(opp)) +
      "）" +
      (e.type === "IPHR" ? "" : (e.dist ? "・推定" + e.dist + "m" : "") + "・" + dirText(e)) +
      "</div>" +
      chipsHTML(e, 3) +
      "</div>" +
      '<div class="nhr-sc"><span' +
      (e.side === "away" ? ' class="b"' : "") +
      ">" +
      esc(teamAbbr(r.away)) +
      sc.away +
      "</span>-<span" +
      (e.side === "home" ? ' class="b"' : "") +
      ">" +
      sc.home +
      esc(teamAbbr(r.home)) +
      "</span></div>" +
      "</div>"
    );
  }

  function gameHead(pen, r) {
    const a = team(r.away);
    const h = team(r.home);
    const mine = r.home === pen.my || r.away === pen.my;
    return (
      '<div class="nhr-gh' +
      (mine ? " mine" : "") +
      '">' +
      (mine ? '<span class="star">★</span>' : "") +
      PB.UI.mark(a, 18) +
      "<b>" +
      esc(a.short) +
      '</b><span class="gsc">' +
      r.as +
      "-" +
      r.hs +
      "</span><b>" +
      esc(h.short) +
      "</b>" +
      PB.UI.mark(h, 18) +
      (r.wo ? "<i>サヨナラ</i>" : "") +
      (r.inn > (pen.innings || 9) ? "<i>延長" + r.inn + "回</i>" : "") +
      "<small>" +
      esc(h.stadium || "") +
      "</small></div>"
    );
  }

  // 試合結果 1 行 (新聞の結果欄ふう)
  function resultRow(pen, r) {
    const a = team(r.away);
    const h = team(r.home);
    const mine = r.home === pen.my || r.away === pen.my;
    const pit = [];
    if (r.W) pit.push('<span class="fp w">勝</span>' + esc(player(r.W).name));
    if (r.L) pit.push('<span class="fp l">敗</span>' + esc(player(r.L).name));
    if (r.S) pit.push('<span class="fp s">S</span>' + esc(player(r.S).name));
    let hrs;
    if (!Array.isArray(r.hr)) hrs = '<div class="nr-hrs"><span class="nr-k">本</span><span class="muted">記録なし</span></div>';
    else if (r.hr.length) hrs = '<div class="nr-hrs"><span class="nr-k">本</span>' + r.hr.map((e) => '<span class="nr-hr"><em>' + esc(teamAbbr(hrTeam(r, e))) + "</em>" + hrLine(e) + "</span>").join("") + "</div>";
    else hrs = "";
    return (
      '<div class="nr' +
      (mine ? " mine" : "") +
      '"><div class="nr-sc">' +
      PB.UI.mark(a, 22) +
      "<b>" +
      esc(a.short) +
      '</b><span class="nr-num' +
      (r.as > r.hs ? " win" : "") +
      '">' +
      r.as +
      '</span><span class="nr-dash">-</span><span class="nr-num' +
      (r.hs > r.as ? " win" : "") +
      '">' +
      r.hs +
      "</span><b>" +
      esc(h.short) +
      "</b>" +
      PB.UI.mark(h, 22) +
      (r.inn > (pen.innings || 9) ? '<span class="nr-ex">延長' + r.inn + "回</span>" : "") +
      (r.wo ? '<span class="nr-ex">サヨナラ</span>' : "") +
      "</div>" +
      (pit.length ? '<div class="nr-pit">' + pit.join(" ") + "</div>" : "") +
      hrs +
      "</div>"
    );
  }

  function lastPlayedDay(pen) {
    return pen.results.length ? pen.results[pen.results.length - 1].day : -1;
  }
  News.lastDay = lastPlayedDay;

  function myLgFirst(pen, lgs) {
    const mine = PB.Pennant.lgOf(pen.my);
    return lgs.slice().sort((a, b) => (a === mine ? -1 : b === mine ? 1 : a < b ? -1 : 1));
  }

  // ハブに置く小さなニュース枠
  News.hubPanel = function (pen) {
    const d = lastPlayedDay(pen);
    if (d < 0) return "";
    const n = dayHRs(pen, d).length;
    const status = dayStatus(pen, d);
    const heads = (pen.news || [])
      .filter((x) => x.day === d)
      .sort((a, b) => b.prio - a.prio)
      .slice(0, 3);
    return (
      '<div class="newsbox"><div class="nb-head"><span class="nb-prog">' +
      PROGRAM +
      '</span><span class="nb-day">第' +
      (d + 1) +
      "戦</span></div>" +
      heads.map((x) => '<div class="nb-line" data-act="news" data-arg="news">' + esc(x.title) + "</div>").join("") +
      '<div class="nb-hr" data-act="news" data-arg="hr"><b>今日のホームラン</b><span>' +
      (status === "nodata" ? "記録なし" : n ? n + "本" : "なし") +
      "</span><em>見る ▶</em></div></div>"
    );
  };

  function hrTab(pen, d) {
    const status = dayStatus(pen, d);
    if (status === "empty") return '<p class="muted center nhr-none">まだ試合がありません</p>';
    const hrs = dayHRs(pen, d);
    const byLg = {};
    for (const x of hrs) {
      const lg = lgOf(x.r.home);
      byLg[lg] = (byLg[lg] || 0) + 1;
    }
    const split = myLgFirst(pen, Object.keys(byLg))
      .map((lg) => (lg === "P" ? "パ" : "セ") + byLg[lg] + "本")
      .join("・");
    let html =
      '<div class="nhr-head"><div><span class="nhr-title">今日のホームラン</span>' +
      (split ? '<span class="nhr-split">' + split + "</span>" : "") +
      '</div><span class="nhr-count">' +
      hrs.length +
      "<small>本</small></span></div>";
    if (status === "nodata") return html + '<p class="muted center nhr-none">この日の本塁打記録はありません（記録開始前のデータ）</p>';
    if (!hrs.length) html += '<p class="muted center nhr-none">今日のホームランはありません</p>';
    else html += '<button class="btn red nhr-play" data-act="digest">▶ ホームランダイジェスト</button>';
    const rs = dayResults(pen, d);
    const lgs = myLgFirst(pen, [...new Set(rs.map((r) => lgOf(r.home)))]);
    for (const lg of lgs) {
      const games = rs.filter((r) => lgOf(r.home) === lg);
      const withHR = games.filter((r) => (r.hr || []).length).sort((a, b) => {
        const am = a.home === pen.my || a.away === pen.my ? 0 : 1;
        const bm = b.home === pen.my || b.away === pen.my ? 0 : 1;
        return am - bm || (a.gi || 0) - (b.gi || 0);
      });
      const zero = games.filter((r) => !(r.hr || []).length);
      if (!withHR.length && !hrs.length) continue;
      html += '<h3 class="lbl nhr-lg">' + esc(LG_SHORT[lg] || lg) + "<span>" + (byLg[lg] || 0) + "本</span></h3>";
      let i = 0;
      for (const r of withHR) html += '<div class="nhr-game">' + gameHead(pen, r) + r.hr.map((e) => hrRow(e, r, i++)).join("") + "</div>";
      if (zero.length) html += '<p class="nhr-zero">本塁打なし　' + zero.map((r) => esc(teamAbbr(r.away)) + " " + r.as + "-" + r.hs + " " + esc(teamAbbr(r.home))).join("／") + "</p>";
    }
    // 本塁打王争い (リーグ別・上位 5 位・同数は同順位)
    const today = {};
    for (const x of hrs) today[x.e.id] = (today[x.e.id] || 0) + 1;
    const rankLgs = myLgFirst(pen, Object.keys(D.LEAGUES || {}).filter((k) => PB.Pennant.lgTeams(pen, k).length));
    html += '<h3 class="lbl">本塁打王争い</h3><div class="nhr-rank">';
    for (const lg of rankLgs) {
      const { rows, more } = rankRows(pen, lg, 5, 6, d);
      html +=
        '<div class="lead"><h4>' +
        esc(LG_SHORT[lg] || lg) +
        '</h4><table class="ltbl">' +
        (rows.length
          ? rows
              .map((x) => "<tr><td>" + x.rank + "</td><th>" + PB.UI.mark(team(x.tid), 14) + " " + esc(x.name) + "</th><td>" + x.hr + "本" + (today[x.id] ? '<i class="today">今日+' + today[x.id] + "</i>" : "") + "</td></tr>")
              .join("") + (more ? '<tr><td></td><th class="muted">ほか' + more + "人</th><td></td></tr>" : "")
          : '<tr><td class="muted">記録なし</td></tr>') +
        "</table></div>";
    }
    html += "</div>";
    html += '<p class="note nhr-foot">飛距離は打球の軌道から求めた推定値です。号数はこのペナントでの本数です。</p>';
    return html;
  }

  // ニュース画面 (日付を前後に移動できる)
  News.screen = function (opt) {
    const pen = store().data.pennant;
    const o = opt || {};
    const days = [...new Set(pen.results.map((r) => r.day))].sort((a, b) => a - b);
    const st = { day: o.day != null && days.indexOf(o.day) >= 0 ? o.day : lastPlayedDay(pen), tab: o.tab || "hr" };
    let digest = null;
    return {
      html() {
        const d = st.day;
        let body = "";
        if (st.tab === "hr") body = hrTab(pen, d);
        else if (st.tab === "res") {
          const rs = dayResults(pen, d);
          body = rs.length
            ? myLgFirst(pen, [...new Set(rs.map((r) => lgOf(r.home)))])
                .map((lg) => '<h3 class="lbl">' + esc(LG_SHORT[lg] || lg) + "</h3>" + rs.filter((r) => lgOf(r.home) === lg).map((r) => resultRow(pen, r)).join(""))
                .join("")
            : '<p class="muted center">まだ試合がありません</p>';
        } else {
          const items = (pen.news || []).filter((n) => n.day === d).sort((a, b) => b.prio - a.prio || String(a.key).localeCompare(String(b.key)));
          body = items.length
            ? '<div class="nlist">' +
              items
                .map(
                  (n) =>
                    '<div class="nitem k-' +
                    n.kind +
                    '">' +
                    (n.team ? '<span class="ni-logo">' + PB.UI.mark(team(n.team), 30) + "</span>" : '<span class="ni-logo ni-lg">' + (n.lg === "P" ? "パ" : n.lg === "C" ? "セ" : "★") + "</span>") +
                    '<div class="ni-txt"><b>' +
                    esc(n.title) +
                    "</b>" +
                    (n.body ? "<small>" + esc(n.body) + "</small>" : "") +
                    "</div></div>"
                )
                .join("") +
              "</div>"
            : '<p class="muted center">この日のニュースはありません</p>';
        }
        const i = days.indexOf(d);
        return (
          PB.UI.header("スポーツニュース", "back") +
          '<div class="scr-body news-body">' +
          '<div class="nday"><button class="btn sm" data-act="prev"' +
          (i <= 0 ? " disabled" : "") +
          '>◀ 前日</button><b>' +
          (d >= 0 ? "第" + (d + 1) + "戦" : "") +
          '</b><button class="btn sm" data-act="next"' +
          (i < 0 || i >= days.length - 1 ? " disabled" : "") +
          ">翌日 ▶</button></div>" +
          PB.Screens.seg(
            "tab",
            [
              ["hr", "今日のホームラン"],
              ["res", "試合結果"],
              ["news", "ニュース"],
            ],
            st.tab
          ) +
          body +
          "</div>"
        );
      },
      unmount() {
        if (digest) digest.close();
        digest = null;
      },
      onAct(act, arg) {
        if (act === "back") return PB.UI.go(o.onBack ? o.onBack() : PB.Pennant.hub());
        if (act === "tab") st.tab = arg;
        else if (act === "prev" || act === "next") {
          const i = days.indexOf(st.day) + (act === "prev" ? -1 : 1);
          if (i >= 0 && i < days.length) st.day = days[i];
        } else if (act === "player") {
          return PB.UI.showPlayer(arg, pen.stats[arg] || null);
        } else if (act === "digest") {
          if (digest && digest.alive()) return;
          digest = News.digest(pen, st.day);
          return;
        }
        PB.UI.refresh();
      },
    };
  };

  /* ---------- ホームランダイジェスト (中継風に 1 本ずつ) ---------- */
  News.digest = function (pen, day) {
    const list = dayHRs(pen, day);
    if (!list.length) return null;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const PER = reduce ? 5000 : 3600;
    const root = document.createElement("div");
    root.className = "hrdg";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "ホームランダイジェスト");
    document.body.appendChild(root);
    let i = -1;
    let timer = null;
    let alive = true;
    const onKey = (ev) => {
      if (ev.key === "Escape") close();
    };
    const close = () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      root.remove();
    };
    document.addEventListener("keydown", onKey);
    const lgCount = new Set(list.map((x) => lgOf(x.r.home))).size;
    const titleCard = () => {
      root.innerHTML =
        '<div class="hrdg-bg" style="--tc:#13819f"></div>' +
        '<div class="hrdg-title"><span class="hrdg-prog">' +
        PROGRAM +
        '</span><b class="hrdg-big">今日のホームラン</b><span class="hrdg-sub">第' +
        (day + 1) +
        "戦　" +
        (lgCount > 1 ? "セ・パ計" : "計") +
        list.length +
        "本</span></div>" +
        '<button class="hrdg-x" data-x="1" aria-label="閉じる">✕</button>';
      if (PB.Audio && PB.Audio.newsJingle) PB.Audio.newsJingle();
      clearTimeout(timer);
      timer = setTimeout(next, 1800);
    };
    const endCard = () => {
      const rankLgs = myLgFirst(pen, Object.keys(D.LEAGUES || {}).filter((k) => PB.Pennant.lgTeams(pen, k).length));
      root.innerHTML =
        '<div class="hrdg-bg" style="--tc:#13819f"></div>' +
        '<div class="hrdg-end"><span class="hrdg-prog">今日のホームラン</span><b class="hrdg-big">本日 計' +
        list.length +
        "本</b>" +
        '<div class="hrdg-rank">' +
        rankLgs
          .map(
            (lg) =>
              "<div><h4>" +
              esc(LG_SHORT[lg] || lg) +
              " 本塁打王争い</h4>" +
              (() => {
                const { rows, more } = rankRows(pen, lg, 3, 4, day);
                return rows.map((x) => "<p><span>" + x.rank + "</span>" + PB.UI.mark(team(x.tid), 16) + esc(x.name) + "<b>" + x.hr + "本</b></p>").join("") + (more ? '<p class="muted"><span></span>ほか' + more + "人</p>" : "");
              })() +
              "</div>"
          )
          .join("") +
        '</div><div class="row-btns"><button class="btn" data-again="1">もう一度</button><button class="btn primary" data-x="1">閉じる</button></div></div>' +
        '<button class="hrdg-x" data-x="1" aria-label="閉じる">✕</button>';
      clearTimeout(timer);
    };
    const card = () => {
      const { e, r } = list[i];
      const tid = hrTeam(r, e);
      const t = team(tid);
      const def = teamDef(tid);
      const c = (def && def.main) || t.main || "#334";
      const sc = e.score || { away: r.as, home: r.hs };
      const title = e.n >= 4 && e.type !== "IPHR" ? "GRAND SLAM" : "HOME RUN";
      const p = player(e.id);
      const full = p.id === e.id && PB.TV && PB.TV.fullName ? PB.TV.fullName(p) : batName(e);
      root.innerHTML =
        '<div class="hrdg-bg" style="--tc:' +
        c +
        '"><div class="hrdg-logo">' +
        (def && def.logo ? '<img src="' + def.logo + '" alt="">' : "") +
        "</div></div>" +
        '<div class="hrdg-top"><span class="hrdg-prog">今日のホームラン</span><span class="hrdg-idx">' +
        (i + 1) +
        " / " +
        list.length +
        '</span></div><div class="hrdg-bar"><i style="width:' +
        ((i + 1) / list.length) * 100 +
        '%"></i></div>' +
        '<button class="hrdg-x" data-x="1" aria-label="閉じる">✕</button>' +
        '<div class="hrdg-bug"><span>' +
        esc(teamAbbr(r.away)) +
        "</span><b>" +
        sc.away +
        "-" +
        sc.home +
        "</b><span>" +
        esc(teamAbbr(r.home)) +
        "</span><em>" +
        e.inn +
        "回" +
        (e.top ? "オモテ" : "ウラ") +
        "</em></div>" +
        '<div class="hrdg-card">' +
        '<div class="hrdg-team">' +
        PB.UI.mark(t, 50) +
        "<b>" +
        esc(t.short) +
        "</b></div>" +
        '<div class="hrdg-name">' +
        esc(full) +
        "</div>" +
        (e.no ? '<div class="hrdg-no"><b class="mnum gold">' + e.no + "</b><small>号</small></div>" : "") +
        '<div class="hrdg-kind">' +
        esc((e.ctx || "") + kindCap(e)) +
        "</div>" +
        '<div class="hrdg-info">投手 ' +
        esc(pitName(e)) +
        "（" +
        esc(teamAbbr(oppTeam(r, e))) +
        "）" +
        (e.type === "IPHR" ? "" : (e.dist ? "・推定" + e.dist + "m" : "") + "・" + dirText(e, true)) +
        "</div>" +
        chipsHTML(e, 4) +
        "</div>" +
        // 中継の HOME RUN 帯 (broadcast.js と同じ見た目)
        '<div class="tv-hr show hrdg-band"><div class="hr-wrap"><div class="hr-rail t"></div><div class="hr-rail b"></div><div class="hr-bar"><span class="hr-nm">' +
        esc(batName(e)) +
        "</span>" +
        (e.no ? '<span class="hr-no">' + e.no + "<small>号</small></span>" : '<span class="hr-no lbl">' + kindShort(e) + "</span>") +
        '<span class="hr-kind">' +
        (e.no ? kindShort(e) : "") +
        '</span></div><div class="hr-title"><span data-t="' +
        title +
        '">' +
        title +
        '</span></div></div></div><p class="hrdg-hint">タップで次へ</p>';
      if (PB.Audio && PB.Audio.fanfare) PB.Audio.fanfare();
      clearTimeout(timer);
      timer = setTimeout(next, PER);
    };
    function next() {
      if (!alive) return;
      i++;
      if (i >= list.length) return endCard();
      card();
    }
    // ボタン (閉じる・もう一度) は click で受ける: pointerdown で消すと、続く click が下の画面に届いてしまう
    root.addEventListener("click", (ev) => {
      if (!alive) return;
      const t = ev.target;
      if (t.closest && t.closest("[data-x]")) {
        ev.preventDefault();
        ev.stopPropagation();
        return close();
      }
      if (t.closest && t.closest("[data-again]")) {
        ev.preventDefault();
        i = -1;
        return titleCard();
      }
    });
    // 画面のタップで次へ (ボタンの上は除く)
    root.addEventListener("pointerdown", (ev) => {
      if (!alive) return;
      const t = ev.target;
      if (t.closest && t.closest("button")) return;
      ev.preventDefault();
      if (i >= list.length) return; // 最後の画面はボタンで閉じる
      next();
    });
    titleCard();
    return { close, alive: () => alive };
  };

  PB.News = News;
})((window.PB = window.PB || {}));
