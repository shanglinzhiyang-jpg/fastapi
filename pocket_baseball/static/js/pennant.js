/* 熱闘！ポケットベースボール — ペナントモード (6球団のリーグ戦) */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const UI = PB.UI;
  const Store = PB.Store;
  const Sc = PB.Screens;
  const esc = U.esc;
  const Pen = {};

  const STAT_KEYS = ["g", "pa", "ab", "h", "d", "t", "hr", "rbi", "r", "bb", "k", "sb", "cs", "sac", "sf", "pg", "gs", "outs", "ph", "pr", "er", "pbb", "pk", "phr", "np", "w", "l", "sv"];

  function roundRobin(ids) {
    const n = ids.length;
    const arr = ids.slice();
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const day = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        day.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
      }
      rounds.push(day);
      arr.splice(1, 0, arr.pop());
    }
    return rounds;
  }

  // ペナントに参加している球団 (古いセーブは全球団)
  function penTeams(pen) {
    const all = Store.teams();
    if (!pen || !pen.ids) return all;
    return all.filter((t) => pen.ids.indexOf(t.id) >= 0);
  }
  Pen.teams = penTeams;
  function lgOf(id) {
    const d = PB.D.teamDef(id);
    return d ? d.lg : "C";
  }
  Pen.lgOf = lgOf;
  // 自チームのリーグ (古いセーブは自チームから求める)
  function myLg(pen) {
    return pen.lg || lgOf(pen.my);
  }
  // リーグごとの球団 (lg を省くと自チームのリーグ)
  function lgTeams(pen, lg) {
    const L = lg || myLg(pen);
    return penTeams(pen).filter((t) => lgOf(t.id) === L);
  }
  Pen.lgTeams = lgTeams;

  Pen.create = function (my, perPair, level, innings) {
    // セ・パ両リーグを同じ日程で進める (自チームは所属リーグの 6 球団と対戦)
    const lg = lgOf(my);
    const ids = Store.teams().map((t) => t.id);
    const byLg = {};
    for (const id of ids) (byLg[lgOf(id)] || (byLg[lgOf(id)] = [])).push(id);
    const leagues = Object.keys(byLg).filter((k) => byLg[k].length >= 2 && byLg[k].length % 2 === 0);
    const rrs = leagues.map((k) => roundRobin(byLg[k]));
    const schedule = [];
    for (let k = 0; k < perPair; k++) {
      const n = rrs[0] ? rrs[0].length : 0;
      for (let r = 0; r < n; r++) {
        const day = [];
        for (const rr of rrs) for (const m of rr[r] || []) day.push(k % 2 === 0 ? { home: m.home, away: m.away } : { home: m.away, away: m.home });
        schedule.push(day);
      }
    }
    const p = { my, lg, ids, perPair, level, innings, schedule, day: 0, results: [], stats: {}, lastPitched: {}, news: [], newsState: { top: {}, hrTop: {}, done: {} }, hrv: 1, hrSince: 0, finished: false, started: Date.now() };
    Store.data.pennant = p;
    Store.save();
    return p;
  };

  Pen.standings = function (pen, lg) {
    const tbl = {};
    for (const t of lgTeams(pen, lg)) tbl[t.id] = { id: t.id, g: 0, w: 0, l: 0, d: 0, rs: 0, ra: 0 };
    for (const r of pen.results) {
      const h = tbl[r.home];
      const a = tbl[r.away];
      if (!h || !a) continue;
      h.g++;
      a.g++;
      h.rs += r.hs;
      h.ra += r.as;
      a.rs += r.as;
      a.ra += r.hs;
      if (r.hs > r.as) {
        h.w++;
        a.l++;
      } else if (r.hs < r.as) {
        a.w++;
        h.l++;
      } else {
        h.d++;
        a.d++;
      }
    }
    const list = Object.values(tbl);
    list.forEach((x) => (x.pct = x.w + x.l ? x.w / (x.w + x.l) : 0));
    list.sort((a, b) => b.pct - a.pct || b.w - a.w || b.rs - b.ra - (a.rs - a.ra));
    const top = list[0];
    list.forEach((x) => (x.gb = (top.w - x.w + (x.l - top.l)) / 2));
    return list;
  };

  function mergeStats(pen, game) {
    for (const id in game.box) {
      const s = game.box[id];
      const t = pen.stats[id] || (pen.stats[id] = {});
      for (const k of STAT_KEYS) if (s[k]) t[k] = (t[k] || 0) + s[k];
    }
    for (const side of ["away", "home"]) for (const id of game.used[side]) pen.lastPitched[id] = { day: pen.day, np: (game.box[id] || {}).np || 0 };
  }

  function tiredList(pen) {
    const out = [];
    for (const id in pen.lastPitched) {
      const lp = pen.lastPitched[id];
      if (lp.day === pen.day - 1 && lp.np >= 15) out.push(id);
    }
    return out;
  }

  function nextStarter(team, pen) {
    const tired = tiredList(pen);
    for (let i = 0; i < team.rotation.length; i++) {
      const id = team.rotation[(team.rotIdx + i) % team.rotation.length];
      const lp = pen.lastPitched[id];
      if (!lp || pen.day - lp.day >= 4 || tired.indexOf(id) < 0) return id;
    }
    return team.rotation[team.rotIdx % team.rotation.length];
  }

  function makeGame(pen, m, user) {
    const home = U.clone(Store.team(m.home));
    const away = U.clone(Store.team(m.away));
    const g = new PB.Game({
      home,
      away,
      innings: pen.innings,
      user,
      level: pen.level,
      tired: tiredList(pen),
      starters: { home: nextStarter(Store.team(m.home), pen), away: nextStarter(Store.team(m.away), pen) },
    });
    // 本塁打の号数はシーズン成績から数える
    g.season = pen.stats;
    return g;
  }

  // その打者が自チームの直近の試合で続けて本塁打を打っているか (今日を含む試合数)
  // 本塁打の記録が無い古い結果に当たったら数えるのをやめる (連続記録をでっち上げない)
  function hrGameStreak(pen, tid, id) {
    let n = 1;
    for (let i = pen.results.length - 1; i >= 0; i--) {
      const r = pen.results[i];
      if (r.home !== tid && r.away !== tid) continue;
      if (!Array.isArray(r.hr) || !r.hr.some((e) => e.id === id)) break;
      n++;
    }
    return n;
  }

  function recordGame(pen, m, game, gi) {
    // 同じ試合を二度記録しない
    if (gi != null && pen.results.some((x) => x.day === pen.day && x.gi === gi)) return;
    const r = { day: pen.day, gi: gi == null ? 0 : gi, home: m.home, away: m.away, hs: game.score.home, as: game.score.away, inn: game.inning };
    const res = game.result || {};
    if (res.W) r.W = res.W;
    if (res.L) r.L = res.L;
    if (res.S) r.S = res.S;
    if (res.walkoff) r.wo = 1;
    // 今日のホームラン用 (試合で起きた本塁打だけ。0 本でも空の配列を残し「記録なし」と区別する)
    if (pen.hrSince == null) pen.hrSince = pen.day;
    const seen = {};
    r.hr = (game.hrLog || []).map((e) => {
      const x = Object.assign({}, e);
      if (pen.day === 0) x.open = 1;
      if (!seen[x.id]) {
        seen[x.id] = 1;
        const gs = hrGameStreak(pen, x.tid || (x.side === "home" ? m.home : m.away), x.id);
        if (gs >= 2) x.gs = gs;
      }
      return x;
    });
    pen.results.push(r);
    mergeStats(pen, game);
    for (const id of [m.home, m.away]) {
      const t = Store.team(id);
      t.rotIdx = ((t.rotIdx || 0) + 1) % t.rotation.length;
    }
  }

  // 1 試合ぶん: 自分の試合は記録だけ、他球場はシミュレーションしてから記録
  function playDayGame(pen, m, gi, myGame) {
    if (m.home === pen.my || m.away === pen.my) {
      if (myGame) recordGame(pen, m, myGame, gi);
      return;
    }
    const g = makeGame(pen, m, null);
    g.simToEnd();
    recordGame(pen, m, g, gi);
  }

  function closeDay(pen) {
    // その日の全試合が確定してからニュースを作る
    if (PB.News) {
      try {
        PB.News.generate(pen, pen.day);
      } catch (err) {
        console.error(err);
      }
    }
    pen.day++;
    if (pen.day >= pen.schedule.length) pen.finished = true;
    Store.save();
  }

  function isMine(pen, m) {
    return m.home === pen.my || m.away === pen.my;
  }
  // まだ記録していないその日の試合 (自分の試合が先)
  function pendingGames(pen) {
    const day = pen.schedule[pen.day] || [];
    const done = new Set(pen.results.filter((r) => r.day === pen.day).map((r) => r.gi));
    return day
      .map((m, gi) => ({ m, gi }))
      .filter((x) => !done.has(x.gi))
      .sort((a, b) => (isMine(pen, b.m) ? 1 : 0) - (isMine(pen, a.m) ? 1 : 0));
  }
  // 途中まで消化した日 (集計中にアプリを閉じたなど)
  function partialDay(pen) {
    return !pen.finished && pen.results.some((r) => r.day === pen.day);
  }
  Pen.partialDay = partialDay;

  // 自分の試合以外を消化して日付を進める
  function finishDay(pen, myGame) {
    for (const x of pendingGames(pen)) playDayGame(pen, x.m, x.gi, myGame);
    closeDay(pen);
  }

  // 画面を止めないよう 1 試合ずつ間をあけて消化する (結果は finishDay と同じ)。
  // 同時に二度は走らせない。自分の試合はすぐ記録して保存する
  let dayLock = false;
  function finishDayAsync(pen, myGame, onProgress, done) {
    if (dayLock || pen.finished || !pen.schedule[pen.day]) return false;
    dayLock = true;
    const dayNo = pen.day;
    const list = pendingGames(pen);
    const others = list.filter((x) => !isMine(pen, x.m)).length;
    let i = 0;
    let k = 0;
    const step = () => {
      if (pen.day !== dayNo || Store.data.pennant !== pen) {
        dayLock = false;
        return done && done();
      }
      if (i >= list.length) {
        closeDay(pen);
        dayLock = false;
        return done && done();
      }
      const x = list[i++];
      playDayGame(pen, x.m, x.gi, myGame);
      if (isMine(pen, x.m)) Store.save();
      else {
        k++;
        if (onProgress) onProgress(k, others);
      }
      setTimeout(step, 0);
    };
    step();
    return true;
  }

  function myMatch(pen) {
    const day = pen.schedule[pen.day];
    return day ? day.find((m) => m.home === pen.my || m.away === pen.my) : null;
  }

  /* ---------- 画面 ---------- */
  Pen.hub = function () {
    const pen = Store.data.pennant;
    if (!pen) return Pen.setup();
    if (pen.finished) return Pen.final();
    let busy = false;
    const hs = { lg: myLg(pen) };
    // 途中まで消化した日があれば (集計中に閉じたなど) 残りを先に消化する
    if (partialDay(pen)) {
      busy = true;
      setTimeout(() => {
        const ok = finishDayAsync(pen, null, null, () => {
          busy = false;
          if (UI.cur && UI.cur.isPenHub) UI.go(pen.finished ? Pen.final() : Pen.hub());
        });
        if (!ok) busy = false;
      }, 30);
    }
    const lgs = Object.keys(D.LEAGUES || {}).filter((k) => lgTeams(pen, k).length);
    return {
      isPenHub: true,
      html() {
        const m = myMatch(pen);
        const my = Store.team(pen.my);
        const oppId = m.home === pen.my ? m.away : m.home;
        const opp = Store.team(oppId);
        const isHome = m.home === pen.my;
        const st = Pen.standings(pen);
        const rank = st.findIndex((x) => x.id === pen.my) + 1;
        const meRow = st.find((x) => x.id === pen.my);
        const mySP = D.player(my, nextStarter(my, pen));
        const opSP = D.player(opp, nextStarter(opp, pen));
        return (
          UI.header("ペナント", "back") +
          '<div class="scr-body">' +
          '<div class="pen-top"><div class="pen-day"><span>第</span><b>' +
          (pen.day + 1) +
          "</b><span>戦 / 全" +
          pen.schedule.length +
          '戦</span></div><div class="pen-rank"><b>' +
          rank +
          "</b>位 " +
          meRow.w +
          "勝" +
          meRow.l +
          "敗" +
          (meRow.d ? meRow.d + "分" : "") +
          "</div></div>" +
          '<div class="matchcard"><div class="mc-team">' +
          UI.mark(isHome ? opp : my, 40) +
          "<b>" +
          esc((isHome ? opp : my).short) +
          "</b><small>先発 " +
          esc((isHome ? opSP : mySP).name) +
          '</small></div><div class="mc-vs">VS<small>' +
          esc(Store.team(m.home).stadium) +
          '</small></div><div class="mc-team">' +
          UI.mark(isHome ? my : opp, 40) +
          "<b>" +
          esc((isHome ? my : opp).short) +
          "</b><small>先発 " +
          esc((isHome ? mySP : opSP).name) +
          "</small></div></div>" +
          '<div class="row-btns"><button class="btn red big" data-act="play"' +
          (busy ? " disabled" : "") +
          '>試合開始</button></div><div class="row-btns"><button class="btn" data-act="sim"' +
          (busy ? " disabled" : "") +
          '>この試合をおまかせ</button><button class="btn" data-act="sim5"' +
          (busy ? " disabled" : "") +
          ">5試合進める</button></div>" +
          (busy ? '<p class="note center">試合を消化しています…</p>' : "") +
          (PB.News ? PB.News.hubPanel(pen) : "") +
          '<h3 class="lbl">順位表</h3>' +
          (lgs.length > 1
            ? Sc.seg(
                "stlg",
                lgs.map((k) => [k, D.LEAGUES[k]]),
                hs.lg
              )
            : "") +
          Pen.standingsHTML(pen, hs.lg === myLg(pen) ? st : Pen.standings(pen, hs.lg)) +
          '<div class="row-btns"><button class="btn" data-act="order">オーダー</button><button class="btn" data-act="leaders">個人成績</button><button class="btn" data-act="results">試合結果</button></div>' +
          (PB.News && pen.results.length ? '<div class="row-btns"><button class="btn" data-act="news" data-arg="news">スポーツニュース</button></div>' : "") +
          '<div class="row-btns"><button class="btn ghost" data-act="abandon">シーズンをやめる</button></div>' +
          "</div>"
        );
      },
      onAct(act, arg) {
        if (busy) return;
        if (act === "back") return UI.go(Sc.title());
        if (act === "stlg") {
          hs.lg = arg;
          return UI.refresh();
        }
        if (act === "news") return UI.go(PB.News.screen({ tab: arg || "hr" }));
        if (act === "order") return UI.go(Sc.order(Store.team(pen.my), { onBack: () => UI.go(Pen.hub()) }));
        if (act === "leaders") return UI.go(Pen.leaders());
        if (act === "results") return UI.go(Pen.results());
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
        if (act === "play") {
          const m = myMatch(pen);
          const user = m.home === pen.my ? "home" : "away";
          const my = Store.team(pen.my);
          const opp = Store.team(user === "home" ? m.away : m.home);
          const g = makeGame(pen, m, user);
          void my;
          void opp;
          UI.hideScreen();
          PB.main.startMatch({
            game: g,
            season: pen.stats,
            night: Store.settings().night,
            onEnd: (match) => {
              PB.main.stopMatch();
              const r = Store.data.records;
              r.games++;
              if (g.result.tie) r.ties++;
              else if (g.result.winner === user) r.wins++;
              else r.losses++;
              // 他球場の試合を消化しているあいだ集計画面を出す
              const prog = { k: 0, n: 0 };
              UI.go({
                html: () => '<div class="scr-body busy-body"><p class="busy-t">他球場の試合を集計中…</p><p class="busy-n">' + prog.k + " / " + prog.n + "</p></div>",
              });
              const dayIdx = pen.day;
              const started = finishDayAsync(
                pen,
                g,
                (k, n) => {
                  prog.k = k;
                  prog.n = n;
                  UI.refresh();
                },
                () => {
                  const n = PB.News ? PB.News.dayHRs(pen, dayIdx).length : 0;
                  const toHub = () => UI.go(pen.finished ? Pen.final() : Pen.hub());
                  UI.go(
                    Sc.result(match, {
                      onDone: toHub,
                      doneLabel: "ペナントへ",
                      extra: PB.News ? { label: "今日のホームラン（" + n + "本）", onTap: () => UI.go(PB.News.screen({ day: dayIdx, tab: "hr", onBack: () => Pen.hub() })) } : null,
                    })
                  );
                }
              );
              // 消化中で受け付けられなかったとき (通常は起きない) は結果だけ出す
              if (!started) UI.go(Sc.result(match, { onDone: () => UI.go(Pen.hub()), doneLabel: "ペナントへ" }));
            },
            onQuit: () => UI.go(Pen.hub()),
          });
          return;
        }
        if (act === "sim" || act === "sim5") {
          busy = true;
          UI.refresh();
          let n = act === "sim5" ? 5 : 1;
          const stepDay = () => {
            if (n-- <= 0 || pen.finished) {
              busy = false;
              if (pen.finished) return UI.go(Pen.final());
              UI.refresh();
              return;
            }
            const m = myMatch(pen);
            const g = makeGame(pen, m, null);
            g.simToEnd();
            if (!finishDayAsync(pen, g, null, () => setTimeout(stepDay, 20))) {
              busy = false;
              UI.refresh();
            }
          };
          setTimeout(stepDay, 60);
        }
      },
    };
  };

  Pen.standingsHTML = function (pen, st) {
    const list = st || Pen.standings(pen);
    return (
      '<div class="tbl-wrap"><table class="stand"><tr><th>順</th><th>チーム</th><th>試</th><th>勝</th><th>敗</th><th>分</th><th>率</th><th>差</th></tr>' +
      list
        .map((x, i) => {
          const t = Store.team(x.id);
          return (
            "<tr" +
            (x.id === pen.my ? ' class="me"' : "") +
            "><td>" +
            (i + 1) +
            "</td><th>" +
            UI.mark(t, 16) +
            " " +
            esc(t.short) +
            "</th><td>" +
            x.g +
            "</td><td>" +
            x.w +
            "</td><td>" +
            x.l +
            "</td><td>" +
            x.d +
            "</td><td>" +
            x.pct.toFixed(3).replace(/^0/, "") +
            "</td><td>" +
            (i === 0 ? "-" : x.gb.toFixed(1)) +
            "</td></tr>"
          );
        })
        .join("") +
      "</table></div>"
    );
  };

  Pen.setup = function () {
    const S = Store.settings();
    const st = { my: "t", perPair: 2, level: S.level, innings: 9 };
    return {
      html() {
        return (
          UI.header("ペナント 新規作成", "back") +
          '<div class="scr-body"><p class="note">6球団の総当たりリーグ戦。自分のチームの試合は自分で操作するか、おまかせで消化できます。</p><h3 class="lbl">あなたのチーム</h3>' +
          Sc.teamPicker("my", st.my, null) +
          '<h3 class="lbl">試合数</h3>' +
          Sc.seg(
            "per",
            [
              [2, "10試合"],
              [4, "20試合"],
              [6, "30試合"],
            ],
            st.perPair
          ) +
          '<h3 class="lbl">イニング</h3>' +
          Sc.seg(
            "inn",
            [
              [3, "3回"],
              [6, "6回"],
              [9, "9回"],
            ],
            st.innings
          ) +
          '<h3 class="lbl">難易度</h3>' +
          Sc.seg(
            "level",
            Object.keys(PB.AI.LEVELS).map((k) => [k, PB.AI.LEVELS[k].name]),
            st.level
          ) +
          '<div class="row-btns stick"><button class="btn red big" data-act="go">シーズン開幕！</button></div></div>'
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Sc.title());
        if (act === "my") st.my = arg;
        else if (act === "per") st.perPair = Number(arg);
        else if (act === "inn") st.innings = Number(arg);
        else if (act === "level") st.level = arg;
        else if (act === "go") {
          Pen.create(st.my, st.perPair, st.level, st.innings);
          return UI.go(Pen.hub());
        }
        UI.refresh();
      },
    };
  };

  Pen.leaders = function () {
    const pen = Store.data.pennant;
    const st = { tab: "bat", lg: myLg(pen) };
    const lgs = Object.keys(D.LEAGUES || {}).filter((k) => lgTeams(pen, k).length);
    return {
      html() {
        const teamGames = pen.results.length ? (pen.results.length * 2) / penTeams(pen).length : 0;
        const all = [];
        for (const t of lgTeams(pen, st.lg)) for (const p of t.players) if (pen.stats[p.id]) all.push({ p, t, s: pen.stats[p.id] });
        const top = (arr, f, fmt, n) =>
          arr
            .sort((a, b) => f(b) - f(a))
            .slice(0, n || 5)
            .map((x, i) => '<tr><td>' + (i + 1) + "</td><th>" + UI.mark(x.t, 14) + " " + esc(x.p.name) + "</th><td>" + fmt(x) + "</td></tr>")
            .join("");
        const block = (title, rows) => '<div class="lead"><h4>' + title + '</h4><table class="ltbl">' + (rows || '<tr><td class="muted">記録なし</td></tr>') + "</table></div>";
        let html = "";
        if (st.tab === "bat") {
          const qual = all.filter((x) => x.p.pos !== "P" && (x.s.pa || 0) >= Math.max(1, teamGames * 3.1));
          const bats = all.filter((x) => x.p.pos !== "P");
          html =
            block("打率", top(qual, (x) => (x.s.ab ? x.s.h / x.s.ab : 0), (x) => U.fmtAvg(x.s.h || 0, x.s.ab || 0))) +
            block("本塁打", top(bats, (x) => x.s.hr || 0, (x) => (x.s.hr || 0) + "本")) +
            block("打点", top(bats, (x) => x.s.rbi || 0, (x) => (x.s.rbi || 0) + "点")) +
            block("安打", top(bats, (x) => x.s.h || 0, (x) => (x.s.h || 0) + "本")) +
            block("盗塁", top(bats, (x) => x.s.sb || 0, (x) => (x.s.sb || 0) + "個"));
        } else {
          const pits = all.filter((x) => x.p.pos === "P");
          const qual = pits.filter((x) => (x.s.outs || 0) >= Math.max(3, teamGames * 3));
          html =
            block("防御率", top(qual, (x) => -(x.s.er || 0) / Math.max(1, x.s.outs || 0), (x) => U.fmtERA(x.s.er || 0, x.s.outs || 0))) +
            block("勝利", top(pits, (x) => x.s.w || 0, (x) => (x.s.w || 0) + "勝")) +
            block("奪三振", top(pits, (x) => x.s.pk || 0, (x) => (x.s.pk || 0) + "個")) +
            block("セーブ", top(pits, (x) => x.s.sv || 0, (x) => (x.s.sv || 0) + "S"));
        }
        return (
          UI.header("個人成績", "back") +
          '<div class="scr-body">' +
          (lgs.length > 1
            ? Sc.seg(
                "lg",
                lgs.map((k) => [k, D.LEAGUES[k]]),
                st.lg
              )
            : "") +
          Sc.seg(
            "tab",
            [
              ["bat", "打者"],
              ["pit", "投手"],
            ],
            st.tab
          ) +
          '<div class="leads">' +
          html +
          "</div></div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(pen.finished ? Pen.final() : Pen.hub());
        if (act === "tab") st.tab = arg;
        if (act === "lg") st.lg = arg;
        UI.refresh();
      },
    };
  };

  Pen.results = function () {
    const pen = Store.data.pennant;
    return {
      html() {
        const mine = pen.results.filter((r) => r.home === pen.my || r.away === pen.my).slice().reverse();
        return (
          UI.header("試合結果", "back") +
          '<div class="scr-body"><div class="olist">' +
          (mine.length
            ? mine
                .map((r) => {
                  const h = Store.team(r.home);
                  const a = Store.team(r.away);
                  const myScore = r.home === pen.my ? r.hs : r.as;
                  const opScore = r.home === pen.my ? r.as : r.hs;
                  const wl = myScore > opScore ? "win" : myScore < opScore ? "lose" : "tie";
                  return '<div class="rrow ' + wl + '"' + (PB.News ? ' data-act="day" data-arg="' + r.day + '"' : "") + '><span class="d">' + (r.day + 1) + "</span>" + UI.mark(a, 18) + "<b>" + esc(a.short) + "</b><span class=\"sc\">" + r.as + " - " + r.hs + "</span><b>" + esc(h.short) + "</b>" + UI.mark(h, 18) + '<span class="wl">' + (wl === "win" ? "○" : wl === "lose" ? "●" : "△") + "</span></div>";
                })
                .join("")
            : '<p class="muted">まだ試合がありません</p>') +
          "</div></div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Pen.hub());
        if (act === "day" && PB.News) UI.go(PB.News.screen({ day: Number(arg), tab: "res", onBack: () => Pen.results() }));
      },
    };
  };

  Pen.final = function () {
    const pen = Store.data.pennant;
    const st = Pen.standings(pen);
    const champ = Store.team(st[0].id);
    const won = st[0].id === pen.my;
    if (won) setTimeout(() => PB.Audio.victory(), 200);
    return {
      cls: "result",
      html() {
        return (
          '<div class="scr-body res-body"><div class="res-head ' +
          (won ? "win" : "") +
          '"><p class="walkoff">ペナントレース終了</p><h2>' +
          (won ? "優勝！！" : esc(champ.name) + " 優勝") +
          "</h2>" +
          UI.mark(champ, 64) +
          "</div>" +
          Pen.standingsHTML(pen, st) +
          Object.keys(D.LEAGUES || {})
            .filter((k) => k !== myLg(pen) && lgTeams(pen, k).length)
            .map((k) => '<h3 class="lbl">' + esc(D.LEAGUES[k]) + "</h3>" + Pen.standingsHTML(pen, Pen.standings(pen, k)))
            .join("") +
          '<div class="row-btns"><button class="btn" data-act="leaders">個人成績</button>' +
          (PB.News && pen.results.length ? '<button class="btn" data-act="news">スポーツニュース</button>' : "") +
          '</div><div class="row-btns stick"><button class="btn red" data-act="new">新しいシーズン</button><button class="btn primary" data-act="title">タイトルへ</button></div></div>'
        );
      },
      onAct(act) {
        if (act === "leaders") return UI.go(Pen.leaders());
        if (act === "news") return UI.go(PB.News.screen({ onBack: () => Pen.final() }));
        if (act === "new") {
          Store.data.pennant = null;
          Store.save();
          return UI.go(Pen.setup());
        }
        UI.go(Sc.title());
      },
    };
  };

  // テスト用 (node から日程を進める)
  Pen._internal = { finishDay, finishDayAsync, makeGame, myMatch, recordGame, hrGameStreak };
  PB.Pennant = Pen;
})((window.PB = window.PB || {}));
