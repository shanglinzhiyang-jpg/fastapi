/* 熱闘！ポケットベースボール — スポーツニュース (ペナント)
   試合で実際に起きた出来事・確定した数字だけから記事を作る (同じ日を二度数えない)。
   目玉は「今日のホームラン」: その日の全試合 (セ・パ) の本塁打を中継風に紹介する。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const esc = U.esc;
  const News = {};

  const MAX_NEWS = 400; // 短いシーズン
  const MAX_NEWS_LONG = 1500; // ハーフ・フル (1 日 6〜8 本 × 約 180 日)
  const MAX_HR_ITEMS = 4; // 1 日に載せる本塁打記事の上限
  const CIRCLED = ["", "①", "②", "③", "④"];
  const LG_SHORT = { C: "セ・リーグ", P: "パ・リーグ" };
  const PROGRAM = "熱闘スポーツ";

  /* ---------- 小物 ---------- */
  function store() {
    return PB.Store;
  }
  // 球団・選手はペナントのアクセサ経由 (L3 でペナント専用の球団に切り替わる)
  function team(id) {
    const P = PB.Pennant;
    return (P && P.team ? P.team(id) : store().team(id)) || { id, short: "?", name: "?", players: [] };
  }
  function allTeams() {
    const P = PB.Pennant;
    return P && P.teams ? P.teams(store().data.pennant) : store().teams();
  }
  function regResults(pen) {
    return PB.Pennant && PB.Pennant.regResults ? PB.Pennant.regResults(pen) : pen.results;
  }
  // 見出しの日付 (4月2日(金) / 古いセーブは 第N日)
  function dayLabel(pen, d) {
    return PB.Pennant && PB.Pennant.dayLabel ? PB.Pennant.dayLabel(pen, d) : "第" + (d + 1) + "日";
  }
  News.dayLabel = dayLabel;
  // ポストシーズン・表彰式の日の呼び名 (日本シリーズ第3戦 など)
  function tagOf(pen, d) {
    return PB.Pennant && PB.Pennant.dayTag ? PB.Pennant.dayTag(pen, d) : "";
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
    for (const t of allTeams()) for (const p of t.players) m[p.id] = p;
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
  // 号数 (ポストシーズンは「シリーズN号」= その系列の本数)
  function noText(e) {
    return e.no ? (e.ps ? "シリーズ" : "") + e.no + "号" : "";
  }
  // 見出し: 鳥谷 4号先制2ラン
  function caption(e) {
    return batName(e) + " " + noText(e) + (e.ctx || "") + kindCap(e);
  }
  News.caption = caption;

  // 本塁打につくタグ (確定した事実だけ・優先順)
  function hrTags(e) {
    const t = [];
    const push = (text, cls) => t.push({ text, cls: cls || "" });
    if (e.ps) push(psTag(e.ps), "gold");
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
    if (e.no === 1 && !e.ps) push("今季1号", "gold");
    if (e.no >= 10 && e.no % 10 === 0 && !e.ps) push(e.no + "号到達", "gold");
    return t;
  }
  function psTag(sid) {
    const pen = store().data.pennant;
    return PB.PenPost && pen ? PB.PenPost.tagOf(pen, sid) : "ポストシーズン";
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
    return esc(batName(e)) + noText(e) + (e.type === "IPHR" ? "(走)" : CIRCLED[Math.min(4, e.n)]) + "(" + esc(pitName(e)) + ")";
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
  function maxNews(pen) {
    const n = pen.regDays || (pen.schedule || []).length || 0;
    return n > 60 ? MAX_NEWS_LONG : MAX_NEWS;
  }
  News.maxNews = maxNews;
  function add(pen, item) {
    pen.news = pen.news || [];
    if (item.key && pen.news.some((n) => n.key === item.key)) return;
    pen.news.push(item);
    const max = maxNews(pen);
    if (pen.news.length > max) pen.news.splice(0, pen.news.length - max);
  }

  // 本塁打 1 本の記事候補 (優先度の高いものから 1 つ)
  function hrHeadline(e) {
    const nm = batName(e);
    const no = e.no ? "（" + noText(e) + "）" : "";
    if (e.ctx === "サヨナラ") return { prio: 90, title: nm + "、サヨナラ" + (e.n === 1 && e.type !== "IPHR" ? "本塁打" : kindCap(e)) + "！" };
    if (e.game >= 3) return { prio: 80, title: nm + "、1試合" + e.game + "本塁打の大暴れ" };
    if (e.n >= 4) return { prio: 70, title: nm + "が" + (e.ctx ? e.ctx + "の" : "") + "満塁本塁打" + no };
    if (e.consec >= 3) return { prio: 70, title: nm + "、" + e.consec + "打席連続本塁打" };
    if (e.game === 2) return { prio: 55, title: nm + "、1試合2本塁打" + no };
    if (e.consec === 2) return { prio: 50, title: nm + "、2打席連続本塁打" };
    // 5 試合連続以上・30/40/50 号は記録 (pennant_records.js) の記事で伝える
    const rec = !!PB.PenRecords && !e.ps;
    if (e.gs >= 3 && !(rec && e.gs >= 5)) return { prio: 50, title: nm + "、" + e.gs + "試合連続本塁打" + no };
    if (e.ph) return { prio: 45, title: e.ctx ? "代打・" + nm + "、" + e.ctx + kindShort(e) : "代打・" + nm + "が" + kindShort(e) };
    if (e.lead) return { prio: 45, title: nm + "、初回先頭打者本塁打" + no };
    if (e.extra) return { prio: 45, title: nm + "、延長" + e.inn + "回に" + (e.ctx || "") + kindShort(e) };
    if (e.both) return { prio: 45, title: nm + "、両打席本塁打" };
    if (e.no >= 10 && e.no % 10 === 0 && !e.ps && !(rec && e.no >= 30 && e.no <= 50)) return { prio: 40, title: nm + "、シーズン" + e.no + "号に到達" };
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
    const rs = regResults(pen);
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
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
      for (const r of regResults(pen)) {
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
    // ポストシーズン・表彰式の日 (レギュラーシーズンの後): 首位争い・本塁打王争い・マジックは作らない
    const postDay = day >= (pen.regDays || (pen.schedule || []).length);
    // 1) 自チームの試合 (ポストシーズンの試合は 6) で系列の記事にする)
    const mine = rs.find((r) => !r.ps && (r.home === pen.my || r.away === pen.my));
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
    // 4) 本塁打王争い・首位争い (リーグごと・レギュラーシーズンだけ)
    for (const lg of Object.keys(D.LEAGUES || { C: 1 })) {
      if (postDay || !Pen.lgTeams(pen, lg).length) continue;
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
    // 5) ペナントレース (マジック・優勝/1 位通過・プレーオフ進出・自チームの可能性消滅)
    if (!postDay) raceNews(pen, day);
    // 6) ポストシーズン (系列の開幕・各試合・勝ち抜け・優勝・日本一・系列の MVP)
    postNews(pen, day);
    // 7) タイトル確定・月間 MVP・表彰
    awardNews(pen, day);
    // 8) 選手の状態 (ケガ・登録/抹消) と記録 (快挙・連続記録・節目)。保存した記録から作るので作り直しても同じ
    if (PB.PenLife) for (const it of PB.PenLife.news(pen, day)) add(pen, it);
    if (PB.PenRecords) for (const it of PB.PenRecords.news(pen, day)) add(pen, it);
    ns.done[day] = 1;
  };

  /* ---------- ポストシーズンの記事 (系列の記録から・乱数なし) ---------- */
  const PS_PRIO = { JS: 140, P2: 115, C2: 115, P1: 100, C1: 100 };
  function postNews(pen, day) {
    const PP = PB.PenPost;
    if (!PP || !pen.post || !pen.post.series) return;
    const innings = pen.innings || 9;
    for (const s of pen.post.series) {
      const prio = (PS_PRIO[s.id] || 100) + (s.hi === pen.my || s.lo === pen.my ? 20 : 0);
      const L = s.lg ? LG_SHORT[s.lg] : "";
      if (s.start === day && s.hi && s.lo)
        add(pen, {
          key: "ps:start:" + s.id,
          day,
          kind: "ps",
          lg: s.lg || null,
          prio: prio - 10,
          title: s.name + "が開幕　" + team(s.hi).short + " vs " + team(s.lo).short,
          body: s.id === "JS" ? "7試合制・4勝で日本一" : s.max + "試合制・" + s.need + "勝で勝ち抜け" + (s.adv ? "。" + team(s.hi).short + "に1勝のアドバンテージ" : ""),
        });
      s.games.forEach((g, i) => {
        if (g.day !== day) return;
        const n = i + 1;
        const after = PP.stateAt(s, n);
        const before = PP.stateAt(s, n - 1);
        const wid = g.hs > g.as ? g.home : g.as > g.hs ? g.away : null;
        const lid = wid ? (wid === g.home ? g.away : g.home) : null;
        const side = (id) => (id === s.hi ? 0 : 1);
        let title;
        let kind = "ps";
        if (after.win) {
          const k = side(after.win);
          const rec = after.w[k] + "勝" + after.w[1 - k] + "敗" + (after.t ? after.t + "分" : "");
          const nm = team(after.win).short;
          if (s.id === "JS") title = nm + "が日本一！ " + rec + "で日本シリーズを制す";
          else if (s.cel === "lg") title = nm + "が" + L + "優勝！ プレーオフを" + rec + "で制す";
          else if (s.cel === "cs") title = nm + "がCS突破、日本シリーズ進出（" + rec + "）";
          else title = nm + "が" + s.stage + "突破（" + rec + "）";
          kind = s.id === "JS" || s.cel === "lg" ? "pswin" : "ps";
        } else if (!wid) title = s.tag + "第" + n + "戦は" + (g.inn > innings ? "延長" + g.inn + "回" : "") + "引き分け";
        else {
          const ww = after.w[side(wid)];
          const wl = after.w[side(lid)];
          const bw = before.w[side(wid)];
          const bl = before.w[side(lid)];
          const how = g.wo ? "がサヨナラ勝ちで" : "が";
          const goal = s.id === "JS" ? "日本一" : s.cel === "lg" ? "優勝" : "突破";
          let what;
          if (ww === s.need - 1 && wl === s.need - 1 && bl === s.need - 1) what = "逆王手";
          else if (ww === s.need - 1) what = goal + "へ王手";
          else if (n === 1 && !s.adv) what = "先勝";
          else if (ww === wl && bw < bl) what = "タイに戻す";
          else what = ww + "勝目";
          title = team(wid).short + how + what + "（" + s.tag + "）";
        }
        const pit = [];
        const r = (pen.results || []).find((x) => x.day === day && x.gi === g.gi) || {};
        if (r.W) pit.push("勝 " + player(r.W).name);
        if (r.L) pit.push("敗 " + player(r.L).name);
        if (r.S) pit.push("S " + player(r.S).name);
        const hrs = (r.hr || []).map((e) => batName(e) + noText(e)).slice(0, 4);
        const body =
          s.tag +
          "第" +
          n +
          "戦（" +
          (team(g.home).stadium || "") +
          "）" +
          team(g.away).short +
          " " +
          g.as +
          "-" +
          g.hs +
          " " +
          team(g.home).short +
          (g.inn > innings ? "（延長" + g.inn + "回）" : "") +
          (pit.length ? "。" + pit.join("、") : "") +
          (hrs.length ? "。本塁打 " + hrs.join("、") : "") +
          "。対戦成績 " +
          team(s.hi).short +
          after.w[0] +
          "勝・" +
          team(s.lo).short +
          after.w[1] +
          "勝" +
          (after.t ? "・" + after.t + "分" : "");
        add(pen, { key: "ps:" + s.id + ":" + n, day, kind, lg: s.lg || null, team: after.win || wid || null, prio: prio + (after.win ? 25 : 0), title, body });
      });
      // 系列の MVP
      const P = pen.post;
      if (s.win && s.end === day && P.mvp && P.mvp[s.id]) {
        const m = P.mvp[s.id];
        add(pen, { key: "ps:mvp:" + s.id, day, kind: "award", team: m.tid, prio: prio + 5, title: PP.mvpLabel(pen, s) + "は" + m.name + "（" + team(m.tid).short + "）", body: m.why || "" });
        if (s.id === "JS" && P.mvp.JSf) add(pen, { key: "ps:mvp:JSf", day, kind: "award", team: P.mvp.JSf.tid, prio: prio - 5, title: "敢闘選手は" + P.mvp.JSf.name + "（" + team(P.mvp.JSf.tid).short + "）", body: P.mvp.JSf.why || "" });
      }
    }
  }

  /* ---------- タイトル・月間 MVP・表彰の記事 (pen.awards から) ---------- */
  function awardNews(pen, day) {
    const A = pen.awards;
    if (!A) return;
    const Aw = PB.PenAwards;
    const lgs = Object.keys(D.LEAGUES || { C: 1 }).filter((lg) => PB.Pennant.lgTeams(pen, lg).length);
    // タイトル確定 (リーグごとに 1 本 + 自チームの受賞者)
    if (A.titles && A.titles.day === day)
      for (const lg of lgs) {
        const list = A.titles[lg] || [];
        add(pen, {
          key: "aw:title:" + lg,
          day,
          kind: "award",
          lg,
          prio: 95,
          title: (LG_SHORT[lg] || "") + "の個人タイトルが確定",
          body: list
            .filter((x) => x.holders.length)
            .map((x) => x.name + " " + x.holders.map((h) => h.name).join("・") + "（" + x.holders[0].v + "）")
            .join("／"),
        });
        for (const x of list)
          for (const h of x.holders)
            if (h.tid === pen.my) add(pen, { key: "aw:title:" + x.key + ":" + h.id, day, kind: "award", team: h.tid, prio: 105, title: h.name + "が" + x.name + "を獲得" + (x.holders.length > 1 ? "（同時受賞）" : ""), body: x.name + " " + h.v });
      }
    // 月間 MVP (区分が終わった次の日)
    const mon = (A.monthly || []).filter((x) => x.day === day && !x.partial);
    const per = Aw ? Aw.PERIODS : {};
    for (const lg of lgs) {
      const ms = mon.filter((x) => x.lg === lg);
      if (!ms.length) continue;
      const k = ms[0].per;
      const part = (kind, label) => {
        const r = ms.find((x) => x.kind === kind);
        return r ? label + " " + r.name + "（" + team(r.tid).short + "）" + r.why : "";
      };
      add(pen, {
        key: "aw:mmvp:" + k + ":" + lg,
        day,
        kind: "award",
        lg,
        team: ms.some((x) => x.tid === pen.my) ? pen.my : null,
        prio: 80 + (ms.some((x) => x.tid === pen.my) ? 20 : 0),
        title: (per[k] || "") + "の月間MVP（" + (lg === "P" ? "パ" : "セ") + "）" + ms.map((x) => x.name).join("・"),
        body: [part("bat", "打者"), part("pit", "投手")].filter(Boolean).join("／"),
      });
    }
    // 年間の表彰 (表彰式の日)
    const S = A.season;
    if (S && S.day === day) {
      for (const lg of lgs) {
        const L = S[lg] || {};
        const nm = (r) => r.name + "（" + team(r.tid).short + "）";
        if (L.mvp) add(pen, { key: "aw:mvp:" + lg, day, kind: "award", lg, team: L.mvp.tid, prio: 130 + (L.mvp.tid === pen.my ? 20 : 0), title: (LG_SHORT[lg] || "") + "MVPは" + nm(L.mvp), body: L.mvp.why || "" });
        if (L.roy) add(pen, { key: "aw:roy:" + lg, day, kind: "award", lg, team: L.roy.tid, prio: 110 + (L.roy.tid === pen.my ? 20 : 0), title: (LG_SHORT[lg] || "") + "の新人王は" + nm(L.roy), body: (L.roy.why || "") + "。" + (S.note || "") });
        const b9 = L.b9 || {};
        const b9list = ["P", "C", "1B", "2B", "3B", "SS"].map((k) => b9[k]).concat(b9.OF || [], b9.DH ? [b9.DH] : []).filter(Boolean);
        if (b9list.length) add(pen, { key: "aw:b9:" + lg, day, kind: "award", lg, prio: 90, title: (LG_SHORT[lg] || "") + "のベストナイン発表", body: b9list.map((r) => (D.POS_JP[r.pos] || "外") + " " + nm(r)).join("、") });
        const gg = L.gg || {};
        const gglist = ["P", "C", "1B", "2B", "3B", "SS"].map((k) => gg[k]).concat(gg.OF || []).filter(Boolean);
        if (gglist.length) add(pen, { key: "aw:gg:" + lg, day, kind: "award", lg, prio: 85, title: (LG_SHORT[lg] || "") + "のゴールデン・グラブ賞発表", body: gglist.map((r) => (D.POS_JP[r.pos] || "外") + " " + nm(r)).join("、") });
      }
      const sw = S.sawamura;
      if (sw) add(pen, { key: "aw:saw", day, kind: "award", team: sw.none ? null : sw.tid, prio: 120, title: sw.none ? "沢村賞は該当者なし" : "沢村賞は" + sw.name + "（" + team(sw.tid).short + "）", body: sw.none ? "7項目の選考基準を多く満たした先発投手がいなかった（ゲーム内の選考）" : sw.why || "" });
    }
  }
  News.postNews = postNews;
  News.awardNews = awardNews;

  // 乱数を使わず、その日の終わりの順位と残り試合から決める。同じ日を作り直しても同じ記事
  function raceNews(pen, day) {
    const Pen = PB.Pennant;
    if (!Pen || !Pen.race) return;
    const ns = pen.newsState;
    ns.magic = ns.magic || {};
    ns.out = ns.out || {};
    const cl = pen.clinch || {};
    const mine = lgOf(pen.my);
    for (const lg of Object.keys(D.LEAGUES || { C: 1 })) {
      if (!Pen.lgTeams(pen, lg).length) continue;
      const rc = Pen.race(pen, lg);
      const P = lg === "P";
      const L = LG_SHORT[lg] || "";
      const recOf = (id) => {
        const x = rc.st.find((y) => y.id === id);
        return x ? x.w + "勝" + x.l + "敗" + (x.d ? x.d + "分" : "") : "";
      };
      const c = cl[lg];
      // 優勝 (セ) / レギュラーシーズン 1 位通過 (パ。2004 年はプレーオフの勝者がリーグ優勝)
      if (c && c.day === day) {
        const nm = team(c.id).short;
        add(pen, {
          key: "clinch:" + lg,
          day,
          kind: "clinch",
          lg,
          team: c.id,
          prio: 120 + (c.id === pen.my ? 20 : 0),
          title: P ? nm + "がレギュラーシーズン1位通過を決める" : nm + "が" + L + "優勝！",
          body: L + " " + recOf(c.id) + (P ? "。プレーオフ第2ステージへ" : ""),
        });
      }
      // マジックの点灯・消滅・再点灯。ns.magic[lg] は {id, m, on, off} の記録 (同じ日を作り直しても同じ記事になる)
      if (!c || c.day === day) {
        const mg = c ? null : rc.magic;
        const log = Array.isArray(ns.magic[lg]) ? ns.magic[lg] : (ns.magic[lg] = []);
        let last = log[log.length - 1];
        if (mg && (!last || last.off != null || last.id !== mg.id) && !(last && last.on === day && last.id === mg.id)) {
          if (last && last.off == null) last.off = day;
          log.push((last = { id: mg.id, m: mg.m, on: day }));
        } else if (!mg && !c && last && last.off == null) last.off = day;
        for (let i = 0; i < log.length; i++) {
          const e = log[i];
          const what = (P ? "1位通過" : "優勝") + "マジック";
          if (e.on === day) {
            const again = log.slice(0, i).some((x) => x.id === e.id);
            add(pen, { key: "magic:" + day + ":" + lg, day, kind: "magic", lg, team: e.id, prio: 70 + (e.id === pen.my ? 20 : 0), title: team(e.id).short + "に" + what + e.m + "が" + (again ? "再点灯" : "点灯"), body: L + " " + recOf(e.id) });
          }
          // 消えた (別の球団に点いた日は点灯の記事だけ)
          if (e.off === day && !log.some((x) => x.on === day) && !c)
            add(pen, { key: "magicoff:" + day + ":" + lg, day, kind: "magic", lg, team: e.id, prio: 55 + (e.id === pen.my ? 20 : 0), title: team(e.id).short + "の" + what + "が消滅", body: L + " " + recOf(e.id) });
        }
      }
      // パ: プレーオフ進出 (3 位以内) が決まった球団
      if (P)
        for (const id in cl.po || {})
          if (cl.po[id] === day)
            add(pen, { key: "po:" + id, day, kind: "po", lg, team: id, prio: 75 + (id === pen.my ? 30 : 0), title: team(id).short + "がプレーオフ進出を決める", body: L + " " + recOf(id) });
      // 自チームの可能性が消えた日
      if (lg === mine) {
        const k1 = "1" + lg;
        if (rc.out1.indexOf(pen.my) >= 0 && (ns.out[k1] == null || ns.out[k1] === day)) {
          ns.out[k1] = day;
          add(pen, { key: "out:" + k1, day, kind: "out", lg, team: pen.my, prio: 85, title: team(pen.my).short + "、" + (P ? "1位通過" : "優勝") + "の可能性が消滅", body: L + " " + recOf(pen.my) });
        }
        // 自力優勝 (1 位通過) の可能性が消えた (まだ可能性はある)
        const kj = "J" + lg;
        if (rc.noSelf.indexOf(pen.my) >= 0 && rc.out1.indexOf(pen.my) < 0 && !cl[lg] && (ns.out[kj] == null || ns.out[kj] === day)) {
          ns.out[kj] = day;
          add(pen, { key: "out:" + kj, day, kind: "out", lg, team: pen.my, prio: 65, title: team(pen.my).short + "、自力" + (P ? "1位通過" : "優勝") + "の可能性が消滅", body: L + " " + recOf(pen.my) });
        }
        if (P && rc.out3.indexOf(pen.my) >= 0 && (ns.out["3P"] == null || ns.out["3P"] === day)) {
          ns.out["3P"] = day;
          add(pen, { key: "out:3P", day, kind: "out", lg, team: pen.my, prio: 86, title: team(pen.my).short + "、プレーオフ進出の可能性が消滅", body: L + " " + recOf(pen.my) });
        }
      }
    }
  }

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
      '</span><span class="nb-day">' +
      esc(dayLabel(pen, d)) +
      "</span></div>" +
      heads.map((x) => '<div class="nb-line" data-act="news" data-arg="news">' + esc(x.title) + "</div>").join("") +
      '<div class="nb-hr" data-act="news" data-arg="hr"><b>今日のホームラン</b><span>' +
      (status === "nodata" ? "記録なし" : n ? n + "本" : "なし") +
      "</span><em>見る ▶</em></div></div>"
    );
  };

  function hrTab(pen, d) {
    const status = dayStatus(pen, d);
    if (status === "empty") return '<p class="muted center nhr-none">' + (d >= 0 && d < pen.day ? "この日は試合がありません" : "まだ試合がありません") + "</p>";
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
    // ポストシーズンの日は本塁打王争い (レギュラーシーズン) を出さない
    if (d >= (pen.regDays || pen.schedule.length)) return html + '<p class="note nhr-foot">号数はこの系列（シリーズ）での本数です。ポストシーズンの本塁打はシーズンの記録に入りません。</p>';
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
  // ニュースのある日 (試合のない表彰式の日も含む)
  function newsDays(pen) {
    return [...new Set(pen.results.map((r) => r.day).concat((pen.news || []).map((n) => n.day)))].filter((d) => d >= 0).sort((a, b) => a - b);
  }
  News.newsDays = newsDays;
  News.screen = function (opt) {
    const pen = store().data.pennant;
    const o = opt || {};
    const days = newsDays(pen);
    const d0 = o.day != null && days.indexOf(o.day) >= 0 ? o.day : days.length ? days[days.length - 1] : -1;
    // 試合のない日 (表彰式) はニュースのタブから
    const st = { day: d0, tab: o.tab && (o.tab === "news" || dayResults(pen, d0).length) ? o.tab : dayResults(pen, d0).length ? "hr" : "news" };
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
                    '"' +
                    (n.pid ? ' data-act="player" data-arg="' + esc(n.pid) + '"' : "") +
                    ">" +
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
          (d >= 0 ? esc(dayLabel(pen, d)) : "") +
          (d >= 0 && tagOf(pen, d) && tagOf(pen, d) !== dayLabel(pen, d) ? "<small>" + esc(tagOf(pen, d)) + "</small>" : "") +
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
          return PB.Pennant.showPlayer ? PB.Pennant.showPlayer(arg) : PB.UI.showPlayer(arg, pen.stats[arg] || null);
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
    // 選手の画像を先に作り始めておく (タイトルの間に描ける)
    if (PB.Cards)
      list.forEach(({ e, r }) => {
        const p = player(e.id);
        if (p.pos) PB.Cards.portraitOf(p, team(hrTeam(r, e)), {});
      });
    const titleCard = () => {
      root.innerHTML =
        '<div class="hrdg-bg" style="--tc:#13819f"></div>' +
        '<div class="hrdg-title"><span class="hrdg-prog">' +
        PROGRAM +
        '</span><b class="hrdg-big">今日のホームラン</b><span class="hrdg-sub">' +
        esc(dayLabel(pen, day)) +
        "　" +
        (lgCount > 1 ? "セ・パ計" : "計") +
        list.length +
        "本</span></div>" +
        '<button class="hrdg-x" data-x="1" aria-label="閉じる">✕</button>';
      if (PB.Audio && PB.Audio.newsJingle) PB.Audio.newsJingle();
      clearTimeout(timer);
      timer = setTimeout(next, 1800);
    };
    const endCard = () => {
      const post = day >= (pen.regDays || pen.schedule.length);
      const rankLgs = post ? [] : myLgFirst(pen, Object.keys(D.LEAGUES || {}).filter((k) => PB.Pennant.lgTeams(pen, k).length));
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
      const full = p.pos && PB.TV && PB.TV.fullName ? PB.TV.fullName(p) : batName(e);
      const withPc = !!(PB.Cards && p.pos);
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
        '<div class="tv-hr show hrdg-band' + (withPc ? " low" : "") + '"><div class="hr-wrap"><div class="hr-rail t"></div><div class="hr-rail b"></div><div class="hr-bar"><span class="hr-nm">' +
        esc(batName(e)) +
        "</span>" +
        (e.no ? '<span class="hr-no">' + e.no + "<small>号</small></span>" : '<span class="hr-no lbl">' + kindShort(e) + "</span>") +
        '<span class="hr-kind">' +
        (e.no ? kindShort(e) : "") +
        '</span></div><div class="hr-title"><span data-t="' +
        title +
        '">' +
        title +
        '</span></div></div></div>' +
        (withPc ? '<div class="hrdg-pc"></div>' : "") +
        '<p class="hrdg-hint">タップで次へ</p>';
      // 打った選手のカード (切り抜きの選手): 記録と HOME RUN の帯の間に収まる大きさで
      const slot = root.querySelector(".hrdg-pc");
      if (slot) {
        const info = root.querySelector(".hrdg-card");
        const band = root.querySelector(".hrdg-band");
        const top = info.offsetTop + info.offsetHeight + 10;
        const avail = band.offsetTop - top - 6;
        const w = Math.round(Math.min(210, window.innerWidth * 0.55, avail / 1.333));
        if (w >= 90) {
          slot.style.top = Math.round(top + Math.max(0, (avail - w * 1.333) / 2)) + "px";
          slot.appendChild(PB.Cards.el(p, t, { w, mini: w < 140 }));
        } else slot.remove();
      }
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
