/* 熱闘！ポケットベースボール — ペナント: 記録 (L3)
 * 試合ごとの快挙 (サイクル安打・1 試合 3 本塁打・ノーヒットノーラン/完全試合・1 試合 15 奪三振)、
 * 連続記録 (連続試合安打・連続試合出塁・連続試合本塁打・救援の連続試合無失点)、
 * 節目 (シーズンとペナント通算) を、ボックススコアと本塁打の記録から乱数を使わずに数える。
 * 連続記録は選手の p.st.streaks に試合ごとに足していく。記事は保存した記録から作るので、作り直しても同じ。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const esc = U.esc;
  const N = () => PB.Pennant;
  const Store = () => PB.Store;
  const Rc = {};
  const n0 = (v) => v || 0;
  const st = (p) => p.st || (p.st = {});
  const isP = (p) => !!p && p.pos === "P";

  // 快挙の種類 (prio: 記事の重さ。0 は記事にしない = 本塁打の記事で伝える)
  const FEAT = {
    cycle: { name: "サイクル安打", short: "サイクル", prio: 125 },
    hr3: { name: "1試合3本塁打", short: "3本塁打", prio: 0 },
    nh: { name: "ノーヒットノーラン", short: "ノーノー", prio: 150 },
    pg: { name: "完全試合", short: "完全試合", prio: 165 },
    nhc: { name: "継投によるノーヒットノーラン", short: "継投ノーノー", prio: 130 },
    pgc: { name: "継投による完全試合", short: "継投完全", prio: 140 },
    k15: { name: "1試合15奪三振以上", short: "15奪三振", prio: 90 },
  };
  Rc.FEAT = FEAT;
  // 連続記録 (記事にする区切り: at = 自チーム / atO = 他球団、every 以上は step ごと。end = 止まったときに記事にする長さ)
  const STREAK = {
    h: { name: "連続試合安打", at: [15, 20, 25], atO: [20, 25], every: 30, step: 1, end: 20, endO: 25 },
    ob: { name: "連続試合出塁", at: [30, 40], atO: [40], every: 50, step: 5, end: 30, endO: 45 },
    hr: { name: "連続試合本塁打", at: [5, 6], atO: [5, 6], every: 7, step: 1, end: 5, endO: 6 },
    rz: { name: "連続試合無失点（救援）", at: [15, 20, 25], atO: [20], every: 30, step: 5, end: 20, endO: 30 },
  };
  Rc.STREAK = STREAK;
  // 節目: シーズン (レギュラーシーズン) とペナント通算 (このゲームで 2004 年から数えた通算)
  const MS = [
    { k: "hr", name: "本塁打", season: [30, 40, 50], career: [100, 200, 300, 400, 500], bat: 1, prio: 75, cprio: 95 },
    { k: "h", name: "安打", season: [200], career: [1000, 1500, 2000], bat: 1, prio: 100, cprio: 95 },
    { k: "w", name: "勝", season: [20], career: [100, 150, 200], prio: 90, cprio: 95 },
    { k: "sv", name: "セーブ", season: [40], career: [100, 200, 250], prio: 85, cprio: 92 },
    { k: "pk", name: "奪三振", season: [200], career: [1000, 1500, 2000], prio: 85, cprio: 90 },
  ];
  Rc.MS = MS;

  Rc.ensure = function (pen) {
    const r = pen.records || (pen.records = {});
    if (r.since == null) r.since = pen.day || 0;
    r.feats = r.feats || [];
    r.ms = r.ms || [];
    r.ev = r.ev || [];
    r.keys = r.keys || {};
    return r;
  };

  /* ---------- 快挙 (1 試合の記録から) ---------- */
  // game: { innings, teams, box, used, hits, score, errors } (Game でも作った箱でもよい)
  Rc.gameFeats = function (game) {
    const out = [];
    const nine = (game.innings || 9) >= 9;
    for (const side of ["away", "home"]) {
      const opp = side === "home" ? "away" : "home";
      const ids = new Set(game.teams[side].players.map((p) => p.id));
      const pits = game.used[side] || [];
      for (const id of Object.keys(game.box)) {
        if (!ids.has(id)) continue;
        const b = game.box[id];
        const single = n0(b.h) - n0(b.d) - n0(b.t) - n0(b.hr);
        if (single >= 1 && n0(b.d) >= 1 && n0(b.t) >= 1 && n0(b.hr) >= 1) out.push({ k: "cycle", side, id });
        if (n0(b.hr) >= 3) out.push({ k: "hr3", side, id, n: b.hr });
        if (pits.indexOf(id) >= 0 && n0(b.pk) >= 15) out.push({ k: "k15", side, id, n: b.pk });
      }
      // ノーヒットノーラン: 9 回以上を無安打無得点で勝つ。完全試合: 四死球・失策もなく走者を 1 人も出さない
      const outs = pits.reduce((a, id) => a + n0((game.box[id] || {}).outs), 0);
      if (nine && pits.length && n0(game.hits[opp]) === 0 && n0(game.score[opp]) === 0 && n0(game.score[side]) > 0 && outs >= 27) {
        const bb = pits.reduce((a, id) => a + n0((game.box[id] || {}).pbb), 0);
        const oppIds = new Set(game.teams[opp].players.map((p) => p.id));
        const pa = Object.keys(game.box)
          .filter((id) => oppIds.has(id))
          .reduce((a, id) => a + n0(game.box[id].pa), 0);
        const perfect = bb === 0 && n0(game.errors && game.errors[side]) === 0 && pa === outs;
        const solo = pits.length === 1;
        out.push({ k: (perfect ? "pg" : "nh") + (solo ? "" : "c"), side, id: solo ? pits[0] : null, ids: pits.slice() });
      }
    }
    return out;
  };

  /* ---------- 連続記録 ---------- */
  function ev(pen, e) {
    Rc.ensure(pen).ev.push(e);
  }
  function setBest(p, k, cur, day) {
    const s = st(p);
    const b = s.best || (s.best = {});
    if (!b[k] || cur[0] > b[k][0]) b[k] = [cur[0], cur[1], day];
  }
  // 記事にする長さになったら記録 (自チームは早めの区切りから)
  function notify(pen, p, tid, k, cur, day) {
    const S = STREAK[k];
    const n = cur[0];
    const at = tid === pen.my ? S.at : S.atO;
    if (at.indexOf(n) >= 0 || (n >= S.every && (n - S.every) % S.step === 0)) ev(pen, { day, t: "s", k, id: p.id, tid, n, s: cur[1] });
  }
  function endStreak(pen, p, tid, k, day) {
    const s = st(p);
    const sk = s.streaks;
    if (!sk || !sk[k]) return;
    if (sk[k][0] >= (tid === pen.my ? STREAK[k].end : STREAK[k].endO)) ev(pen, { day, t: "e", k, id: p.id, tid, n: sk[k][0], s: sk[k][1] });
    delete sk[k];
    if (!Object.keys(sk).length) delete s.streaks;
  }
  // ok: 記録が続いた / counts: 止まる試合か (打数 0 の試合は連続試合安打を止めない)
  function bump(pen, p, tid, k, ok, counts, day, outs) {
    const s = st(p);
    if (ok) {
      const sk = s.streaks || (s.streaks = {});
      const cur = sk[k] || [0, day];
      cur[0]++;
      if (k === "rz") cur[2] = n0(cur[2]) + n0(outs);
      sk[k] = cur;
      setBest(p, k, cur, day);
      notify(pen, p, tid, k, cur, day);
    } else if (counts) endStreak(pen, p, tid, k, day);
  }
  // 連続試合本塁打は本塁打の「N試合連続」の印と同じ数 (球団の試合ごと・出場しない試合でも止まる)
  function setHR(pen, p, tid, n, day) {
    const s = st(p);
    const sk = s.streaks || (s.streaks = {});
    const prev = sk.hr;
    const cur = [n, prev && prev[0] === n - 1 ? prev[1] : day];
    sk.hr = cur;
    setBest(p, "hr", cur, day);
    notify(pen, p, tid, "hr", cur, day);
  }
  function streaks(pen, m, game, r) {
    const day = pen.day;
    for (const side of ["away", "home"]) {
      const tid = side === "home" ? m.home : m.away;
      const team = N().team(tid, pen);
      if (!team) continue;
      const P = {};
      for (const p of team.players) P[p.id] = p;
      const ids = new Set(game.teams[side].players.map((p) => p.id));
      // 打者: 連続試合安打・連続試合出塁 (打席に立った試合だけ。打数 0 の試合は安打の連続を止めない)
      for (const id of Object.keys(game.box)) {
        const p = P[id];
        const b = game.box[id];
        if (!ids.has(id) || !p || isP(p) || !b.pa) continue;
        bump(pen, p, tid, "h", n0(b.h) > 0, n0(b.ab) > 0, day);
        bump(pen, p, tid, "ob", n0(b.h) + n0(b.bb) > 0, true, day);
      }
      // 連続試合本塁打
      const hrN = {};
      for (const e of (r && r.hr) || []) {
        const et = e.tid || (e.side === "home" ? m.home : m.away);
        if (et === tid && hrN[e.id] == null) hrN[e.id] = e.gs || 1;
      }
      for (const p of team.players) {
        if (hrN[p.id] != null) setHR(pen, p, tid, hrN[p.id], day);
        else if (p.st && p.st.streaks && p.st.streaks.hr) endStreak(pen, p, tid, "hr", day);
      }
      // 救援投手: 連続試合無失点 (先発した試合は数えない)
      for (const id of (game.used[side] || []).slice(1)) {
        const p = P[id];
        if (!p) continue;
        const b = game.box[id] || {};
        bump(pen, p, tid, "rz", !n0(b.pr), true, day, n0(b.outs));
      }
    }
  }

  /* ---------- 節目 ---------- */
  // ペナント通算 = 過去の年度 (L4 で pen.yearly に入る) + 今季
  Rc.career = function (pen, pid) {
    const out = {};
    const add = (s) => {
      for (const k in s || {}) if (typeof s[k] === "number") out[k] = n0(out[k]) + s[k];
    };
    const ys = pen.yearly && pen.yearly[pid];
    if (Array.isArray(ys)) for (const y of ys) if (y && y.y !== (pen.year || 2004)) add(y.s);
    add(pen.stats && pen.stats[pid]);
    return out;
  };
  function milestones(pen, m, game) {
    const rec = Rc.ensure(pen);
    const day = pen.day;
    const year = pen.year || 2004;
    for (const side of ["away", "home"]) {
      const tid = side === "home" ? m.home : m.away;
      const opp = side === "home" ? m.away : m.home;
      const team = N().team(tid, pen);
      if (!team) continue;
      const ids = new Set(game.teams[side].players.map((p) => p.id));
      const P = {};
      for (const p of team.players) P[p.id] = p;
      for (const id of Object.keys(game.box)) {
        const p = P[id];
        const b = game.box[id];
        const s1 = pen.stats && pen.stats[id];
        if (!ids.has(id) || !p || !s1) continue;
        let car = null;
        for (const M of MS) {
          const add = n0(b[M.k]);
          if (!add || !!M.bat === isP(p)) continue;
          const v1 = n0(s1[M.k]);
          for (const lv of M.season) {
            const key = "s" + year + ":" + id + ":" + M.k + lv;
            if (v1 - add < lv && v1 >= lv && !rec.keys[key]) {
              rec.keys[key] = 1;
              rec.ms.push({ day, k: M.k, lv, id, tid, opp, park: m.home, v: v1, y: year });
            }
          }
          car = car || Rc.career(pen, id);
          const c1 = n0(car[M.k]);
          for (const lv of M.career) {
            const key = "c:" + id + ":" + M.k + lv;
            if (c1 - add < lv && c1 >= lv && !rec.keys[key]) {
              rec.keys[key] = 1;
              rec.ms.push({ day, k: M.k, lv, c: 1, id, tid, opp, park: m.home, v: c1, y: year });
            }
          }
        }
      }
    }
  }

  /* ---------- 試合の後 ---------- */
  Rc.afterGame = function (pen, m, game, r) {
    const rec = Rc.ensure(pen);
    const day = pen.day;
    const tidOf = (side) => (side === "home" ? m.home : m.away);
    for (const f of Rc.gameFeats(game)) {
      const e = { day, k: f.k, tid: tidOf(f.side), opp: tidOf(f.side === "home" ? "away" : "home"), park: m.home, gi: r ? r.gi : 0 };
      if (f.id) e.id = f.id;
      else if (f.ids) e.ids = f.ids;
      if (f.n) e.n = f.n;
      if (m.ps) e.ps = m.ps;
      rec.feats.push(e);
    }
    // 連続記録・節目はレギュラーシーズンだけ
    if (m.ps || !pen.teams) return;
    streaks(pen, m, game, r);
    milestones(pen, m, game);
  };
  if (PB.Pennant && PB.Pennant.hooks) PB.Pennant.hooks.afterGame.push((pen, m, game, r) => Rc.afterGame(pen, m, game, r));

  /* ---------- 記事 (保存した記録から・乱数なし) ---------- */
  function pname(pen, id) {
    const f = id ? N().findPlayer(id, pen) : null;
    return f ? f.p.name : "?";
  }
  const tshort = (pen, tid) => (N().team(tid, pen) || { short: "?" }).short;
  const park = (pen, tid) => (N().team(tid, pen) || {}).stadium || "";
  function featTitle(pen, f) {
    const F = FEAT[f.k];
    const who = f.id ? pname(pen, f.id) + "（" + tshort(pen, f.tid) + "）" : tshort(pen, f.tid);
    if (f.k === "pg" || f.k === "nh") return who + "が" + F.name + "を達成！";
    if (f.k === "pgc" || f.k === "nhc") return tshort(pen, f.tid) + "が" + F.name + "を達成";
    if (f.k === "cycle") return who + "がサイクル安打を達成！";
    if (f.k === "k15") return who + "が" + f.n + "奪三振の快投";
    return who + "が" + F.name;
  }
  Rc.featTitle = featTitle;
  function msTitle(pen, x) {
    const M = MS.find((y) => y.k === x.k) || { name: "" };
    const nm = pname(pen, x.id);
    if (x.c) return nm + "がペナント通算" + x.lv + (x.k === "hr" ? "本塁打" : x.k === "w" ? "勝" : M.name) + "に到達";
    if (x.k === "hr") return nm + "がシーズン" + x.lv + "号に到達";
    if (x.k === "h") return nm + "がシーズン" + x.lv + "安打を達成";
    if (x.k === "w") return nm + "が" + x.lv + "勝目";
    if (x.k === "sv") return nm + "がシーズン" + x.lv + "セーブ";
    return nm + "がシーズン" + x.lv + M.name;
  }
  Rc.msTitle = msTitle;
  Rc.news = function (pen, day) {
    const out = [];
    const rec = pen.records;
    if (!rec) return out;
    const mine = (tid) => (tid === pen.my ? 20 : 0);
    rec.feats.forEach((f, i) => {
      if (f.day !== day || !FEAT[f.k] || !FEAT[f.k].prio) return;
      const by = f.ids ? f.ids.map((id) => pname(pen, id)).join("→") : "";
      out.push({ key: "feat:" + day + ":" + f.gi + ":" + f.k + ":" + (f.id || f.tid), day, kind: "feat", team: f.tid, pid: f.id || undefined, prio: FEAT[f.k].prio + mine(f.tid), title: featTitle(pen, f), body: "対" + tshort(pen, f.opp) + "（" + park(pen, f.park) + "）" + (by ? "。継投 " + by : "") + (f.ps && PB.PenPost ? "。" + PB.PenPost.tagOf(pen, f.ps) : "") });
      void i;
    });
    for (const e of rec.ev) {
      if (e.day !== day) continue;
      const S = STREAK[e.k];
      const nm = pname(pen, e.id);
      if (e.t === "s") out.push({ key: "sk:" + e.k + ":" + e.id + ":" + e.s + ":" + e.n, day, kind: "streak", team: e.tid, pid: e.id, prio: 62 + Math.min(30, e.n) + mine(e.tid), title: nm + "（" + tshort(pen, e.tid) + "）、" + e.n + "試合" + S.name.replace(/^連続試合/, "連続").replace("（救援）", ""), body: S.name + " " + e.n + "（" + N().dayShort(pen, e.s) + "から）" });
      else out.push({ key: "ske:" + e.k + ":" + e.id + ":" + e.s, day, kind: "streak", team: e.tid, pid: e.id, prio: 55 + mine(e.tid), title: nm + "の" + S.name + "は" + e.n + "で止まる", body: N().dayShort(pen, e.s) + "から" + e.n + "試合" });
    }
    for (const x of rec.ms) {
      if (x.day !== day) continue;
      const M = MS.find((y) => y.k === x.k) || {};
      out.push({ key: "ms:" + (x.c ? "c" : x.y) + ":" + x.id + ":" + x.k + x.lv, day, kind: "ms", team: x.tid, pid: x.id, prio: (x.c ? M.cprio : M.prio) + mine(x.tid), title: msTitle(pen, x), body: "対" + tshort(pen, x.opp) + "（" + park(pen, x.park) + "）" + (x.c ? "。ペナント通算は2004年からこのゲームで数えた記録" : "") });
    }
    return out;
  };

  /* ---------- 画面: 記録室 ---------- */
  const UI = () => PB.UI;
  function streakLeaders(pen, k, which, n) {
    const rows = [];
    for (const t of pen.teams || N().teams(pen))
      for (const p of t.players) {
        const s = p.st || {};
        const x = which === "cur" ? s.streaks && s.streaks[k] : s.best && s.best[k];
        if (x && x[0] >= 2) rows.push({ p, t, n: x[0], from: x[1], to: x[2] });
      }
    rows.sort((a, b) => b.n - a.n || a.from - b.from);
    return rows.slice(0, n || 5);
  }
  Rc.streakLeaders = streakLeaders;
  Rc.screen = function (o) {
    const opt = o || {};
    const pen = Store().data.pennant;
    Rc.ensure(pen);
    const s0 = { tab: opt.tab || "feat" };
    const who = (p, t) => '<span class="rc-who" data-act="player" data-arg="' + esc(p.id) + '">' + UI().mark(t, 18) + "<b>" + esc(p.name) + "</b></span>";
    return {
      pen: true,
      html() {
        const rec = pen.records;
        let body = "";
        if (s0.tab === "feat") {
          const list = rec.feats.slice().reverse();
          body = list.length
            ? '<div class="rc-list">' +
              list
                .map((f) => {
                  const t = N().team(f.tid, pen);
                  const f0 = f.id ? N().findPlayer(f.id, pen) : null;
                  return (
                    '<div class="rc-row' +
                    (f.tid === pen.my ? " me" : "") +
                    '"><span class="rc-d">' +
                    esc(N().dayShort(pen, f.day)) +
                    '</span><i class="rc-k k-' +
                    f.k +
                    '">' +
                    esc(FEAT[f.k].short) +
                    "</i>" +
                    (f0 ? who(f0.p, t) : '<span class="rc-who">' + UI().mark(t, 18) + "<b>" + esc(t.short) + "</b><small>" + esc((f.ids || []).map((id) => pname(pen, id)).join("→")) + "</small></span>") +
                    '<small class="rc-vs">' +
                    (f.n ? f.n + (f.k === "k15" ? "奪三振" : "本") + "・" : "") +
                    "対" +
                    esc(tshort(pen, f.opp)) +
                    (f.ps && PB.PenPost ? "・" + esc(PB.PenPost.tagOf(pen, f.ps)) : "") +
                    "</small></div>"
                  );
                })
                .join("") +
              "</div>"
            : '<p class="muted center">今季の快挙はまだありません</p>';
          body += '<p class="note small">サイクル安打・1試合3本塁打以上・ノーヒットノーラン／完全試合（継投も区別）・1試合15奪三振以上。ポストシーズンの試合も含みます。</p>';
        } else if (s0.tab === "streak") {
          body =
            '<div class="leads">' +
            Object.keys(STREAK)
              .map((k) => {
                const cur = streakLeaders(pen, k, "cur", 5);
                const best = streakLeaders(pen, k, "best", 5);
                const tr = (x, i, done) => '<tr class="' + (x.t.id === pen.my ? "me" : "") + '"><td>' + (i + 1) + "</td><th>" + who(x.p, x.t) + "</th><td>" + x.n + "<small>" + esc(N().dayShort(pen, x.from)) + (done ? "〜" + esc(N().dayShort(pen, x.to)) : "〜") + "</small></td></tr>";
                return (
                  '<div class="lead rc-sk"><h4>' +
                  esc(STREAK[k].name) +
                  '</h4><p class="rc-sub">継続中</p><table class="ltbl">' +
                  (cur.length ? cur.map((x, i) => tr(x, i, false)).join("") : '<tr><td class="muted">なし</td></tr>') +
                  '</table><p class="rc-sub">今季最長</p><table class="ltbl">' +
                  (best.length ? best.map((x, i) => tr(x, i, true)).join("") : '<tr><td class="muted">なし</td></tr>') +
                  "</table></div>"
                );
              })
              .join("") +
            "</div>" +
            '<p class="note small">連続試合安打は打数のない試合（四死球・犠打だけ）では止まりません。連続試合本塁打は球団の試合ごとに数えます（出場しない試合でも止まる）。救援の連続試合無失点は先発した試合を数えません。レギュラーシーズンだけ。</p>';
        } else {
          const list = rec.ms.slice().reverse();
          body = list.length
            ? '<div class="rc-list">' +
              list
                .map((x) => {
                  const f = N().findPlayer(x.id, pen);
                  const t = N().team(x.tid, pen);
                  return (
                    '<div class="rc-row' +
                    (x.tid === pen.my ? " me" : "") +
                    '"><span class="rc-d">' +
                    esc(N().dayShort(pen, x.day)) +
                    '</span><i class="rc-k ' +
                    (x.c ? "k-car" : "k-ms") +
                    '">' +
                    (x.c ? "通算" : "今季") +
                    "</i>" +
                    (f ? who(f.p, t) : "") +
                    '<small class="rc-vs">' +
                    esc(msTitle(pen, x).replace(/^.*?が/, "")) +
                    "・対" +
                    esc(tshort(pen, x.opp)) +
                    "（" +
                    esc(park(pen, x.park)) +
                    "）</small></div>"
                  );
                })
                .join("") +
              "</div>"
            : '<p class="muted center">まだ節目の記録はありません</p>';
          body += '<p class="note small">シーズン: 30・40・50本塁打、200安打、20勝、40セーブ、200奪三振。ペナント通算: 100本塁打・1000安打・100勝・100セーブなど（2004年からこのゲームで数えた通算）。</p>';
        }
        return (
          UI().header("記録室", "back") +
          '<div class="scr-body rc-body">' +
          PB.Screens.seg(
            "tab",
            [
              ["feat", "快挙"],
              ["streak", "連続記録"],
              ["ms", "節目"],
            ],
            s0.tab
          ) +
          body +
          (rec.since > 0 ? '<p class="note small">記録は' + esc(N().dayLabel(pen, rec.since)) + "から（このセーブを新しい版に移したあと）数えています。</p>" : "") +
          "</div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI().go(opt.onBack ? opt.onBack() : pen.finished ? N().final() : N().hub());
        if (act === "tab") s0.tab = arg;
        if (act === "player") return N().showPlayer(arg);
        UI().refresh();
      },
    };
  };

  // 選手モーダルの記録欄 (連続記録・節目・快挙・ペナント通算)
  Rc.playerHTML = function (pen, p) {
    const rec = pen.records;
    if (!rec) return "";
    const s = p.st || {};
    const bits = [];
    for (const k of Object.keys(STREAK)) {
      const cur = s.streaks && s.streaks[k];
      const best = s.best && s.best[k];
      if ((cur && cur[0] >= 3) || (best && best[0] >= 5)) bits.push("<span>" + esc(STREAK[k].name) + "<b>" + (cur ? cur[0] : 0) + "</b>" + (best && (!cur || best[0] > cur[0]) ? "<small>最長" + best[0] + "</small>" : "") + "</span>");
    }
    const ms = rec.ms.filter((x) => x.id === p.id).map((x) => "<li>" + esc(N().dayShort(pen, x.day)) + " " + esc(msTitle(pen, x).replace(/^.*?が/, "")) + "</li>");
    const ft = rec.feats.filter((f) => f.id === p.id || (f.ids && f.ids.indexOf(p.id) >= 0)).map((f) => "<li>" + esc(N().dayShort(pen, f.day)) + " " + esc(FEAT[f.k].name) + "</li>");
    // ペナント通算 (前の年度があるときだけ。L4 で年度の記録が入る)
    const ys = pen.yearly && pen.yearly[p.id];
    let car = "";
    if (Array.isArray(ys) && ys.some((y) => y && y.y !== (pen.year || 2004))) {
      const c = Rc.career(pen, p.id);
      car = isP(p) ? "通算 " + n0(c.pg) + "登板 " + n0(c.w) + "勝" + n0(c.l) + "敗" + n0(c.sv) + "S 防御率" + U.fmtERA(n0(c.er), n0(c.outs)) : "通算 " + n0(c.g) + "試合 打率" + U.fmtAvg(n0(c.h), n0(c.ab)) + " " + n0(c.hr) + "本 " + n0(c.rbi) + "打点";
    }
    if (!bits.length && !ms.length && !ft.length && !car) return "";
    return (
      '<div class="plm plm-rec"><h4 class="plm-h">記録</h4>' +
      (bits.length ? '<div class="plm-sk">' + bits.join("") + "</div>" : "") +
      (ft.length || ms.length ? '<ul class="plm-ms">' + ft.concat(ms).join("") + "</ul>" : "") +
      (car ? '<p class="plm-car">' + esc(car) + "</p>" : "") +
      "</div>"
    );
  };

  Rc._internal = { streaks, milestones, bump, endStreak };
  PB.PenRecords = Rc;
})((window.PB = window.PB || {}));
