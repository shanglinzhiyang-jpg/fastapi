/* 熱闘！ポケットベースボール — ペナントモード (セ・パ 12 球団・2004 年)
 * 日程は pennant_sched.js (2004 年の暦の架空の日程)、他球場の試合は quicksim.js (高速) か物理版 (精密) で消化する。
 * 後のレーン (ポストシーズン・選手の状態・オフ) はアクセサ (Pen.team など)・フック (Pen.hooks)・移行 (Store.migrations) につなぐ。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const UI = PB.UI;
  const Store = PB.Store;
  const Sc = PB.Screens;
  const esc = U.esc;
  const Pen = {};
  Pen.V = 4; // セーブの版

  const STAT_KEYS = ["g", "pa", "ab", "h", "d", "t", "hr", "rbi", "r", "bb", "k", "sb", "cs", "sac", "sf", "pg", "gs", "outs", "ph", "pr", "er", "pbb", "pk", "phr", "np", "w", "l", "sv", "fe"];
  Pen.STAT_KEYS = STAT_KEYS;
  const Sched = () => PB.PenSched;

  /* ---------- アクセサ (ペナント専用の球団の写し pen.teams。写しのない古い形は Store の球団) ---------- */
  // ペナントに参加している球団 (二軍・故障者を含む)
  function penTeams(pen) {
    if (pen && Array.isArray(pen.teams)) return pen.teams;
    const all = Store.teams();
    if (!pen || !pen.ids) return all;
    return all.filter((t) => pen.ids.indexOf(t.id) >= 0);
  }
  Pen.teams = penTeams;
  // 球団 (pen を省くと今のペナント)
  function teamOf(pen, id) {
    if (pen && Array.isArray(pen.teams)) return pen.teams.find((t) => t.id === id) || null;
    return Store.team(id);
  }
  Pen.team = (id, pen) => teamOf(pen || Store.data.pennant, id);
  // 選手 ID → { p, team }
  Pen.findPlayer = function (id, pen) {
    for (const t of penTeams(pen || Store.data.pennant)) {
      const p = t.players.find((x) => x.id === id);
      if (p) return { p, team: t };
    }
    return null;
  };
  // ペナントの選手モーダル (状態・二軍成績・記録つき)
  Pen.showPlayer = function (id) {
    const pen = Store.data.pennant;
    if (PB.PenLife && pen && pen.teams) return PB.PenLife.showPlayer(id);
    return UI.showPlayer(id, pen && pen.stats ? pen.stats[id] || null : null);
  };
  // オーダー画面 (ペナントの球団の一軍だけ。決定したら写しに戻す)
  Pen.orderScreen = function (onBack) {
    const pen = Store.data.pennant;
    if (PB.PenLife && pen && pen.teams) return PB.PenLife.orderScreen(pen, onBack);
    return Sc.order(Pen.team(pen.my), { onBack: () => UI.go(onBack ? onBack() : Pen.hub()) });
  };
  // レギュラーシーズンの結果 (ポストシーズンの試合 ps を除く)
  Pen.regResults = function (pen) {
    const rs = pen.results || [];
    for (const r of rs) if (r.ps) return rs.filter((x) => !x.ps);
    return rs;
  };
  // その日の日付 (2004 年の通し日)。日付の無い古いセーブは null
  function dateOf(pen, day) {
    return pen && pen.dates && pen.dates[day] != null ? pen.dates[day] : null;
  }
  Pen.dateOf = dateOf;
  // ポストシーズン・表彰式の日の呼び名 (日本シリーズ第3戦 など)。それ以外の日は ""
  Pen.dayTag = function (pen, day) {
    return PB.PenPost && pen && day >= regDays(pen) ? PB.PenPost.dayTag(pen, day) : "";
  };
  // 見出しの日付: 4月2日(金) / 日付の無い古いセーブは 第N日 (ポストシーズンは 日本シリーズ第3戦 など)
  Pen.dayLabel = function (pen, day) {
    const n = dateOf(pen, day);
    if (n != null && Sched()) return Sched().label(n);
    return Pen.dayTag(pen, day) || "第" + (day + 1) + "日";
  };
  Pen.dayShort = function (pen, day) {
    const n = dateOf(pen, day);
    return n != null && Sched() ? Sched().short(n) : String(day + 1);
  };
  // 2 つの日の間の日数 (暦の日数。日付が無ければ日程の日数)
  function gapDays(pen, d0, d1) {
    const a = dateOf(pen, d0);
    const b = dateOf(pen, d1);
    return a != null && b != null ? b - a : d1 - d0;
  }
  Pen.gapDays = gapDays;

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
  const isMine = (pen, m) => m.home === pen.my || m.away === pen.my;
  const regDays = (pen) => pen.regDays || pen.schedule.length;

  // 日程から数える値 (球団ごとの試合数・組ごとの対戦数)。日程が変わらない限り使い回す
  const schedCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function schedInfo(pen) {
    const n = regDays(pen);
    let c = schedCache && schedCache.get(pen);
    if (c && c.n === n && c.sched === pen.schedule) return c;
    const games = {};
    const h2h = {};
    for (let d = 0; d < n; d++)
      for (const m of pen.schedule[d] || []) {
        games[m.home] = (games[m.home] || 0) + 1;
        games[m.away] = (games[m.away] || 0) + 1;
        const k = pairKey(m.home, m.away);
        h2h[k] = (h2h[k] || 0) + 1;
      }
    c = { n, sched: pen.schedule, games, h2h };
    if (schedCache) schedCache.set(pen, c);
    return c;
  }
  function pairKey(a, b) {
    return a < b ? a + "|" + b : b + "|" + a;
  }
  // 自チームの試合数 (レギュラーシーズン) と何試合目か
  Pen.myTotal = (pen) => schedInfo(pen).games[pen.my] || 0;
  Pen.myGameNo = (pen) => Pen.regResults(pen).filter((r) => isMine(pen, r)).length + 1;

  /* ---------- セーブの移行 (v なし → v2) ---------- */
  Pen.migrate = function (pen) {
    if (!pen || typeof pen !== "object" || !Array.isArray(pen.schedule)) return pen;
    if (!pen.v || pen.v < 2) {
      const per = pen.perPair;
      pen.opts = pen.opts || { len: per ? "s" + per * 5 : "custom", innings: pen.innings || 9, level: pen.level || "normal", strike: false, il: false, cs: false, fast: "phys", post: false };
      pen.year = pen.year || 2004;
      pen.seed = pen.seed || (Math.abs(Math.floor(pen.started || 1)) % 2147483647) || 1;
      pen.regDays = pen.regDays || pen.schedule.length;
      pen.clinch = pen.clinch || {};
      pen.newsState = pen.newsState || { top: {}, hrTop: {}, done: {} };
      pen.newsState.magic = pen.newsState.magic || {};
      // 日付は作らない (古いセーブは「第N日」で表示する)
      pen.v = 2;
    }
    if (pen.v < 3) {
      // v3: ポストシーズン・タイトル・表彰。終わっていないシーズンは 2004 年方式のポストシーズンへ進む。
      // 終わったシーズンには何も足さない (ポストシーズン・表彰を作り話で足さない)
      pen.opts = pen.opts || {};
      if (!pen.finished) pen.opts.post = true;
      else pen.legacyEnd = 1;
      // 完投・ホールド・守備位置などを記録し始めた日 (それより前の日は「記録なし」)
      if (pen.statsSince == null) pen.statsSince = pen.results.length ? pen.day + (pen.results.some((r) => r.day === pen.day) ? 1 : 0) : 0;
      pen.v = 3;
    }
    if (pen.v < 4 && PB.PenLife) {
      // v4: ペナント専用の球団の写し (今の Store の球団から。rotIdx・オーダーを引き継ぐ)・二軍・選手の状態・記録
      PB.PenLife.migrate(pen);
      pen.v = 4;
    }
    return pen;
  };
  if (Store.migrations) Store.migrations.push((data) => data && data.pennant && Pen.migrate(data.pennant));

  /* ---------- 日の前後の処理 (後のレーンがつなぐ所) ---------- */
  // beforeDay(pen, day) / afterGame(pen, m, game, r) / afterDay(pen, day) / regularEnd(pen)
  Pen.hooks = { beforeDay: [], afterGame: [], afterDay: [], regularEnd: [] };
  function runHooks(name, ...args) {
    for (const fn of Pen.hooks[name] || []) {
      try {
        fn(...args);
      } catch (err) {
        console.error(err);
      }
    }
  }
  // その日の最初に 1 回だけ
  function beginDay(pen) {
    if (pen.finished || pen.begun === pen.day) return;
    pen.begun = pen.day;
    runHooks("beforeDay", pen, pen.day);
  }
  Pen.beginDay = beginDay;

  /* ---------- 作成 ---------- */
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
  function byLeague() {
    const byLg = {};
    for (const t of Store.teams()) (byLg[lgOf(t.id)] || (byLg[lgOf(t.id)] = [])).push(t.id);
    return byLg;
  }
  function basePen(my, o, schedule) {
    return {
      v: Pen.V,
      my,
      lg: lgOf(my),
      ids: Store.teams().map((t) => t.id),
      opts: o,
      level: o.level,
      innings: o.innings,
      year: 2004,
      seed: o.seed,
      schedule,
      regDays: schedule.length,
      day: 0,
      results: [],
      stats: {},
      lastPitched: {},
      news: [],
      newsState: { top: {}, hrTop: {}, done: {}, magic: {} },
      hrv: 1,
      hrSince: 0,
      clinch: {},
      statsSince: 0,
      post: null,
      awards: null,
      finished: false,
      started: Date.now(),
    };
  }
  // 古い呼び方 (my, perPair, level, innings): 日付の無い総当たり (セ・パが同じ日に各 3 試合)
  function createLegacy(my, perPair, level, innings) {
    const byLg = byLeague();
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
    const o = { len: "s" + perPair * 5, innings, level, strike: false, il: false, cs: false, fast: "phys", post: false, seed: (Date.now() % 2147483647) || 1 };
    const p = basePen(my, o, schedule);
    p.perPair = perPair;
    return p;
  }
  // opts = { len: s10|s20|s30|half|full, innings, level, strike, il, cs, fast: quick|phys, post, seed }
  Pen.create = function (my, a, level, innings) {
    let p;
    if (typeof a === "number") p = createLegacy(my, a, level, innings);
    else {
      const o = Object.assign({ len: "full", innings: 9, level: "normal", strike: true, il: false, cs: false, fast: null, post: true }, a || {});
      if (!o.fast) o.fast = Sched().isShort(o.len) ? "phys" : "quick";
      o.seed = o.seed || (Date.now() % 2147483647) || 1;
      const sc = Sched().build({ len: o.len, strike: o.strike, il: o.il, seed: o.seed }, byLeague());
      p = basePen(my, o, sc.days);
      p.dates = sc.dates;
      p.regDays = sc.regDays;
      const L = Sched().LENS[o.len];
      if (L && typeof L.perPair === "number") p.perPair = L.perPair;
    }
    // 球団の写し・二軍・選手の状態 (クイック対戦の球団とは別に持つ)
    if (PB.PenLife) PB.PenLife.init(p);
    Store.data.pennant = p;
    Store.save();
    return p;
  };

  /* ---------- 順位表・マジック ---------- */
  // 球団ごとに数える (交流戦の試合も各球団の成績に入る)。勝率は引き分けを除く (2004 年と同じ)
  Pen.standings = function (pen, lg) {
    const tbl = {};
    for (const t of lgTeams(pen, lg)) tbl[t.id] = { id: t.id, g: 0, w: 0, l: 0, d: 0, rs: 0, ra: 0 };
    for (const r of Pen.regResults(pen)) {
      const h = tbl[r.home];
      const a = tbl[r.away];
      if (h) {
        h.g++;
        h.rs += r.hs;
        h.ra += r.as;
        if (r.hs > r.as) h.w++;
        else if (r.hs < r.as) h.l++;
        else h.d++;
      }
      if (a) {
        a.g++;
        a.rs += r.as;
        a.ra += r.hs;
        if (r.as > r.hs) a.w++;
        else if (r.as < r.hs) a.l++;
        else a.d++;
      }
    }
    const games = schedInfo(pen).games;
    const list = Object.values(tbl);
    list.forEach((x) => {
      x.pct = x.w + x.l ? x.w / (x.w + x.l) : 0;
      x.rem = Math.max(0, (games[x.id] || 0) - x.g);
    });
    // 勝率 → 勝利数 → 得失点差 (同率の順位はゲームの設定)
    list.sort((a, b) => b.pct - a.pct || b.w - a.w || b.rs - b.ra - (a.rs - a.ra) || (a.id < b.id ? -1 : 1));
    const top = list[0];
    list.forEach((x) => (x.gb = top ? (top.w - x.w + (x.l - top.l)) / 2 : 0));
    return list;
  };

  // 残り試合の直接対決 (日程の対戦数 − 消化した対戦数)
  function h2hLeft(pen) {
    const info = schedInfo(pen);
    const played = {};
    for (const r of Pen.regResults(pen)) {
      const k = pairKey(r.home, r.away);
      played[k] = (played[k] || 0) + 1;
    }
    return (a, b) => {
      const k = pairKey(a, b);
      return Math.max(0, (info.h2h[k] || 0) - (played[k] || 0));
    };
  }
  // A が残り m 勝 (直接対決以外から先に勝ち、残りは負け)、B が残り全勝 (A が勝った直接対決だけ負け) でも
  // A の勝率 > B の勝率 か (引き分けは考えない = A に不利な側で計算)
  function aboveWith(A, B, m, h) {
    const hA = Math.max(0, m - Math.max(0, A.rem - h));
    const aw = A.w + m;
    const al = A.l + (A.rem - m);
    const bw = B.w + Math.max(0, B.rem - hA);
    const bl = B.l + hA;
    return aw * (bw + bl) > bw * (aw + al);
  }
  Pen.aboveWith = aboveWith;
  // マジック: 首位がこの数だけ勝てば (他の結果に関係なく) 単独 1 位が決まる最小の数。点灯しなければ null
  Pen.magic = function (pen, lg, stIn, left) {
    const st = stIn || Pen.standings(pen, lg);
    if (st.length < 2) return null;
    const A = st[0];
    const h2 = left || h2hLeft(pen);
    for (let m = 0; m <= A.rem; m++) if (st.slice(1).every((B) => aboveWith(A, B, m, h2(A.id, B.id)))) return { id: A.id, m };
    return null;
  };
  // 自力優勝 (残り試合に全勝すれば、他の結果に関係なく単独 1 位) の可能性があるか
  function canWinAlone(st, x, left) {
    return st.every((y) => y === x || aboveWith(x, y, x.rem, left(x.id, y.id)));
  }
  // ペナントレースの状態 (乱数を使わない・同じ記録から同じ結果)
  //   champ: 1 位が決まった球団 / magic: {id, m} (プロ野球と同じく、2 位以下の全球団が自力優勝の可能性を失ったときだけ点灯)
  //   po: 3 位以内が決まった球団 (パ) / out1・out3: 1 位・3 位以内の可能性が消えた球団 / noSelf: 自力優勝の可能性が消えた球団
  Pen.race = function (pen, lg) {
    const st = Pen.standings(pen, lg);
    const left = h2hLeft(pen);
    const raw = Pen.magic(pen, lg, st, left);
    const noSelf = st.filter((x) => !canWinAlone(st, x, left)).map((x) => x.id);
    const mg = raw && st.slice(1).every((x) => noSelf.indexOf(x.id) >= 0) ? raw : null;
    const over = st.length && st.every((x) => x.rem === 0) && st.some((x) => x.g > 0);
    const champ = raw && raw.m === 0 ? raw.id : over ? st[0].id : null;
    const minP = (x) => (x.w + x.l + x.rem ? x.w / (x.w + x.l + x.rem) : 0);
    const maxP = (x) => (x.w + x.l + x.rem ? (x.w + x.rem) / (x.w + x.l + x.rem) : 0);
    const po = [];
    const out1 = [];
    const out3 = [];
    for (const x of st) {
      const others = st.filter((y) => y !== x);
      // 3 位以内: x の最低の勝率に届きうる球団が 2 つ以下
      if (others.filter((y) => maxP(y) >= minP(x)).length <= 2) po.push(x.id);
      // 1 位の可能性なし: x が全勝しても必ず上にいる球団がある (または優勝が決まった)
      if ((champ && champ !== x.id) || others.some((y) => minP(y) > maxP(x))) out1.push(x.id);
      if (others.filter((y) => minP(y) > maxP(x)).length >= 3) out3.push(x.id);
    }
    return { st, magic: mg && mg.m > 0 ? mg : null, champ, po: over ? st.slice(0, 3).map((x) => x.id) : po, out1, out3, noSelf };
  };
  // 1 日の終わりに優勝・1 位通過・プレーオフ進出を記録する (一度だけ)
  function checkRace(pen, day) {
    pen.clinch = pen.clinch || {};
    for (const lg of Object.keys(D.LEAGUES || { C: 1 })) {
      if (!lgTeams(pen, lg).length || !Pen.regResults(pen).length) continue;
      const rc = Pen.race(pen, lg);
      if (rc.champ && !pen.clinch[lg]) pen.clinch[lg] = { id: rc.champ, day };
      if (lg === "P") {
        const po = pen.clinch.po || (pen.clinch.po = {});
        for (const id of rc.po) if (po[id] == null) po[id] = day;
      }
    }
  }
  Pen.checkRace = checkRace;

  // 直近 10 試合 (○●△) と連勝・連敗 (引き分けで止まる。ニュースの連勝と同じ数え方)
  Pen.recent = function (pen, id, n) {
    const N = n || 10;
    const rs = Pen.regResults(pen);
    const last = [];
    let streak = null;
    let open = true;
    for (let i = rs.length - 1; i >= 0 && (open || last.length < N); i--) {
      const r = rs[i];
      if (r.home !== id && r.away !== id) continue;
      const my = r.home === id ? r.hs : r.as;
      const op = r.home === id ? r.as : r.hs;
      const x = my > op ? "w" : my < op ? "l" : "d";
      if (last.length < N) last.push(x);
      if (!open) continue;
      if (x === "d") open = false;
      else if (!streak) streak = { kind: x, n: 1 };
      else if (x === streak.kind) streak.n++;
      else open = false;
    }
    return { last: last.reverse(), streak };
  };

  /* ---------- 試合 ---------- */
  // ホールド (ゲームの簡易判定・要確認): 先発・最後の投手以外の救援投手で、勝利・敗戦・セーブがつかず、
  // (a) 3 点差以内のリードで登板し 1 アウト以上取ってリードを保って降板、または (b) 同点で登板し失点せずに降板
  function holdsOf(game, side) {
    const log = (game.pitLog && game.pitLog[side]) || [];
    const res = game.result || {};
    const out = [];
    for (let i = 1; i < log.length - 1; i++) {
      const e = log[i];
      const b = game.box[e.id] || {};
      if (e.id === res.W || e.id === res.L || e.id === res.S || e.out == null) continue;
      if ((e.in >= 1 && e.in <= 3 && e.out >= 1 && (b.outs || 0) >= 1) || (e.in === 0 && e.out >= 0 && !(b.pr || 0) && (b.outs || 0) >= 1)) out.push(e.id);
    }
    return out;
  }
  Pen.holdsOf = holdsOf;
  // 守備位置ごとの出場 (試合開始時の打順と最後の打順から。投手は登板した全員)
  function posPairs(game, side) {
    const seen = {};
    const out = [];
    const add = (id, pos) => {
      if (!id || !pos || pos === "PH" || seen[id + pos]) return;
      seen[id + pos] = 1;
      out.push([id, pos]);
    };
    for (const e of (game.pos0 && game.pos0[side]) || []) if (e[1] !== "P") add(e[0], e[1]);
    for (const e of game.order[side]) if (e.pos !== "P") add(e.id, e.pos);
    for (const id of game.used[side]) add(id, "P");
    return out;
  }
  Pen.posPairs = posPairs;
  const inc = (S, id, k) => {
    const t = S[id] || (S[id] = {});
    t[k] = (t[k] || 0) + 1;
  };
  // 試合の成績を足す (into: ポストシーズンは系列ごとの成績。省くとシーズン成績)
  function mergeStats(pen, game, into) {
    const S = into || pen.stats;
    for (const id in game.box) {
      const s = game.box[id];
      const t = S[id] || (S[id] = {});
      for (const k of STAT_KEYS) if (s[k]) t[k] = (t[k] || 0) + s[k];
    }
    // 完投・完封 (チームで投手 1 人・9 回制)、QS (6 回以上・自責 3 以内)、救援勝利、ホールド
    const reg = (game.innings || 9) >= 9;
    for (const side of ["away", "home"]) {
      const used = game.used[side];
      if (!used.length) continue;
      const sp = used[0];
      const b = game.box[sp] || {};
      const opp = side === "home" ? "away" : "home";
      if (reg && used.length === 1) {
        inc(S, sp, "cg");
        if (game.score[opp] === 0) inc(S, sp, "sho");
      }
      if (reg && (b.outs || 0) >= 18 && (b.er || 0) <= 3) inc(S, sp, "qs");
      for (const id of used.slice(1)) if ((game.box[id] || {}).w) inc(S, id, "rw");
      for (const id of holdsOf(game, side)) inc(S, id, "hld");
      for (const [id, pos] of posPairs(game, side)) {
        const t = S[id] || (S[id] = {});
        const P = t.pos || (t.pos = {});
        P[pos] = (P[pos] || 0) + 1;
      }
    }
    for (const side of ["away", "home"]) for (const id of game.used[side]) pen.lastPitched[id] = { day: pen.day, np: (game.box[id] || {}).np || 0 };
  }
  Pen.mergeStats = mergeStats;
  // ポストシーズンの系列の成績 (pen.stats とは別)
  function postStats(pen, sid) {
    const P = pen.post || (pen.post = { series: [], stats: {} });
    const st = P.stats || (P.stats = {});
    return st[sid] || (st[sid] = {});
  }
  Pen.postStats = postStats;

  // 前日 (暦の 1 日前) に 15 球以上投げた投手
  function tiredList(pen) {
    const out = [];
    for (const id in pen.lastPitched) {
      const lp = pen.lastPitched[id];
      if (lp.day < pen.day && gapDays(pen, lp.day, pen.day) === 1 && lp.np >= 15) out.push(id);
    }
    return out;
  }

  function nextStarter(team, pen) {
    // 選手の状態 (L3) があれば: ローテーションの順に中4日以上あいて疲れの残っていない投手
    if (pen && pen.teams && PB.PenLife) return PB.PenLife.starter(pen, team, pen.day);
    const tired = tiredList(pen);
    for (let i = 0; i < team.rotation.length; i++) {
      const id = team.rotation[((team.rotIdx || 0) + i) % team.rotation.length];
      const lp = pen.lastPitched[id];
      if (!lp || gapDays(pen, lp.day, pen.day) >= 4 || tired.indexOf(id) < 0) return id;
    }
    return team.rotation[(team.rotIdx || 0) % team.rotation.length];
  }
  Pen.nextStarter = (team, pen) => nextStarter(team, pen);

  // 他球場・一括消化を高速シミュレーションにするか
  const useQuick = (pen) => !!(pen.opts && pen.opts.fast === "quick" && PB.QuickGame);
  Pen.useQuick = useQuick;

  // o.quick: 高速シミュレーション (自分が操作する試合は常に物理版)
  function makeGame(pen, m, user, o) {
    // その日の編成 (ケガ人の抹消・入れ替え) を先に済ませる
    beginDay(pen);
    let home;
    let away;
    let tired;
    let starters;
    if (pen.teams && PB.PenLife) {
      // 一軍のケガのない選手だけのコピー (調子を反映・投げられない救援は外す・ベンチ入り 25 人)
      const h = PB.PenLife.gameTeam(pen, m.home, pen.day);
      const a = PB.PenLife.gameTeam(pen, m.away, pen.day);
      home = h.team;
      away = a.team;
      tired = h.tired.concat(a.tired);
      starters = { home: h.starter, away: a.starter };
    } else {
      home = U.clone(teamOf(pen, m.home));
      away = U.clone(teamOf(pen, m.away));
      tired = tiredList(pen);
      starters = { home: nextStarter(teamOf(pen, m.home), pen), away: nextStarter(teamOf(pen, m.away), pen) };
    }
    const Cls = o && o.quick && !user && PB.QuickGame ? PB.QuickGame : PB.Game;
    // ポストシーズン: 延長の上限は表 (RULES_2004) から
    const ps = m.ps && pen.post ? m.ps : null;
    const g = new Cls({
      home,
      away,
      innings: pen.innings,
      maxInnings: ps && PB.PenPost ? PB.PenPost.maxInnings(pen, m) : undefined,
      user,
      level: pen.level,
      tired,
      starters,
    });
    // 本塁打の号数はシーズン成績から数える (ポストシーズンはその系列の成績 = シリーズN号)
    g.season = ps ? postStats(pen, ps) : pen.stats;
    // 試合開始時の守備位置 (守備位置ごとの出場を数える)
    g.pos0 = { away: g.order.away.map((e) => [e.id, e.pos]), home: g.order.home.map((e) => [e.id, e.pos]) };
    return g;
  }

  // その打者が自チームの直近の試合で続けて本塁打を打っているか (今日を含む試合数)
  // 本塁打の記録が無い古い結果に当たったら数えるのをやめる (連続記録をでっち上げない)
  // ps: ポストシーズンはその系列の試合だけで数える (シーズンの記録とつなげない)
  function hrGameStreak(pen, tid, id, ps) {
    let n = 1;
    for (let i = pen.results.length - 1; i >= 0; i--) {
      const r = pen.results[i];
      if (r.home !== tid && r.away !== tid) continue;
      if ((r.ps || null) !== (ps || null)) continue;
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
    if (m.il) r.il = 1;
    // ポストシーズンの試合 (系列 ID と第何戦か)。成績は pen.stats に足さず系列ごとに
    const ps = m.ps || null;
    if (ps) {
      r.ps = ps;
      r.gn = m.g || 0;
    }
    // 今日のホームラン用 (試合で起きた本塁打だけ。0 本でも空の配列を残し「記録なし」と区別する)
    if (pen.hrSince == null) pen.hrSince = pen.day;
    const seen = {};
    r.hr = (game.hrLog || []).map((e) => {
      const x = Object.assign({}, e);
      if (pen.day === 0) x.open = 1;
      if (ps) x.ps = ps;
      if (!seen[x.id]) {
        seen[x.id] = 1;
        const gs = hrGameStreak(pen, x.tid || (x.side === "home" ? m.home : m.away), x.id, ps);
        if (gs >= 2) x.gs = gs;
      }
      return x;
    });
    pen.results.push(r);
    mergeStats(pen, game, ps ? postStats(pen, ps) : null);
    // 次の先発: 投げた先発の次 (ローテーション外の先発が投げた日はそのまま)
    for (const side of ["home", "away"]) {
      const t = teamOf(pen, m[side]);
      if (!t || !t.rotation.length) continue;
      const i = t.rotation.indexOf(game.used[side][0]);
      if (i >= 0) t.rotIdx = (i + 1) % t.rotation.length;
      else if (!pen.teams) t.rotIdx = ((t.rotIdx || 0) + 1) % t.rotation.length;
    }
    runHooks("afterGame", pen, m, game, r);
  }

  // 渡された試合 (自分の試合は Game、観戦した試合は { gi, game })
  function givenGame(pen, m, gi, given) {
    if (!given) return null;
    if (given.box) return isMine(pen, m) ? given : null;
    return given.gi === gi ? given.game : null;
  }
  // 1 試合ぶん: 渡された試合 (自分の試合・観戦した試合) は記録、それ以外 (自分の試合が未記録のまま再開した日を含む) はシミュレーションしてから記録
  function playDayGame(pen, m, gi, myGame) {
    const gv = givenGame(pen, m, gi, myGame);
    if (gv) {
      recordGame(pen, m, gv, gi);
      return;
    }
    const g = makeGame(pen, m, null, { quick: useQuick(pen) });
    g.simToEnd();
    recordGame(pen, m, g, gi);
  }

  function closeDay(pen) {
    const day = pen.day;
    runHooks("afterDay", pen, day);
    try {
      checkRace(pen, day);
    } catch (err) {
      console.error(err);
    }
    // その日の全試合が確定してからニュースを作る
    if (PB.News) {
      try {
        PB.News.generate(pen, day);
      } catch (err) {
        console.error(err);
      }
    }
    pen.day++;
    if (pen.day >= regDays(pen) && !pen.regEnd) {
      pen.regEnd = 1;
      runHooks("regularEnd", pen);
    }
    if (pen.day >= pen.schedule.length) pen.finished = true;
    Store.save();
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

  // その日の試合をすべて消化して日付を進める
  function finishDay(pen, myGame) {
    beginDay(pen);
    for (const x of pendingGames(pen)) playDayGame(pen, x.m, x.gi, myGame);
    closeDay(pen);
  }

  // 画面を止めないよう少しずつ間をあけて消化する (結果は finishDay と同じ)。
  // 同時に二度は走らせない。自分の試合はすぐ記録して保存する
  let dayLock = false;
  function finishDayAsync(pen, myGame, onProgress, done) {
    if (dayLock || pen.finished || !pen.schedule[pen.day]) return false;
    dayLock = true;
    beginDay(pen);
    const dayNo = pen.day;
    const list = pendingGames(pen);
    const others = list.filter((x) => !isMine(pen, x.m) && !givenGame(pen, x.m, x.gi, myGame)).length;
    let i = 0;
    let k = 0;
    let first = true;
    const step = () => {
      if (pen.day !== dayNo || Store.data.pennant !== pen) {
        dayLock = false;
        return done && done();
      }
      const t0 = Date.now();
      // 最初は 1 試合だけ、その後は 1 回に 12ms ぶんまで (高速シミュレーションは数試合ずつ)
      while (i < list.length) {
        const x = list[i++];
        playDayGame(pen, x.m, x.gi, myGame);
        if (isMine(pen, x.m) || givenGame(pen, x.m, x.gi, myGame)) Store.save();
        else {
          k++;
          if (onProgress) onProgress(k, others);
        }
        if (first || Date.now() - t0 > 12) break;
      }
      first = false;
      if (i >= list.length) {
        closeDay(pen);
        dayLock = false;
        return done && done();
      }
      setTimeout(step, 0);
    };
    step();
    return true;
  }
  Pen.busy = () => dayLock;

  function myMatch(pen) {
    const day = pen.schedule[pen.day];
    return day ? day.find((m) => isMine(pen, m)) || null : null;
  }
  Pen.myMatch = myMatch;
  // 今日の自分の試合がもう記録されているか
  function myRecorded(pen) {
    const m = myMatch(pen);
    if (!m) return false;
    const gi = pen.schedule[pen.day].indexOf(m);
    return pen.results.some((r) => r.day === pen.day && r.gi === gi);
  }
  // 次の自分の試合の日 (今日を含む)
  Pen.nextMyDay = function (pen) {
    for (let d = pen.day; d < pen.schedule.length; d++) if ((pen.schedule[d] || []).some((m) => isMine(pen, m))) return d;
    return -1;
  };

  /* ---------- 一括消化 (次の試合まで・1 週間・月末まで・シーズン終了まで) ---------- */
  // 1 日ずつ finishDayAsync で進め、stopFn(pen, ctl) が真になった日の始めで止まる。
  // ctl.stop = true で「その日を終えてから」止まる。保存は毎日 (closeDay)
  Pen.simUntil = function (pen, stopFn, onProgress, done) {
    const ctl = { stop: false, days: 0, games: 0 };
    const quick = useQuick(pen);
    const next = () => {
      if (ctl.stop || pen.finished || Store.data.pennant !== pen || stopFn(pen, ctl)) {
        ctl.done = true;
        return done && done(ctl);
      }
      beginDay(pen);
      let g = null;
      const m = myMatch(pen);
      if (m && !myRecorded(pen)) {
        g = makeGame(pen, m, null, { quick });
        g.simToEnd();
        ctl.games++;
      }
      const ok = finishDayAsync(pen, g, null, () => {
        ctl.days++;
        if (onProgress) onProgress(pen, ctl);
        setTimeout(next, 0);
      });
      if (!ok) {
        ctl.done = true;
        if (done) done(ctl);
      }
    };
    setTimeout(next, 0);
    return ctl;
  };
  // 止める条件
  Pen.stops = {
    // 次に自分の試合がある日 (少なくとも 1 日は進める)
    nextGame: () => (p, ctl) => ctl.days > 0 && !!myMatch(p),
    // 暦で 7 日以上進んだ日
    week: (p0) => {
      const d0 = p0.day;
      const n0 = dateOf(p0, d0);
      return (p) => p.day >= regDays(p) || (n0 != null && dateOf(p, p.day) != null ? dateOf(p, p.day) >= n0 + 7 : p.day >= d0 + 7);
    },
    // 次の月の最初の日
    month: (p0) => {
      const n0 = dateOf(p0, p0.day);
      const m0 = n0 != null ? Sched().month(n0) : null;
      const d0 = p0.day;
      return (p) => p.day >= regDays(p) || (m0 != null && dateOf(p, p.day) != null ? Sched().month(dateOf(p, p.day)) !== m0 : p.day >= d0 + 30);
    },
    // レギュラーシーズンの終わり
    season: () => (p) => p.day >= regDays(p),
  };

  /* ---------- 画面 ---------- */
  const SIM_LABEL = { next: "次の試合まで", week: "1週間", month: "月末まで", season: "シーズン終了まで" };
  function recText(x) {
    return x ? x.w + "勝" + x.l + "敗" + (x.d ? x.d + "分" : "") : "";
  }
  // 一括消化の進行表示 (全画面)。ボタンを押しやすいよう、毎日の更新は文字と棒だけ書き換える
  Pen.simScreen = function (kind) {
    const pen = Store.data.pennant;
    const stop = kind === "next" ? Pen.stops.nextGame() : kind === "week" ? Pen.stops.week(pen) : kind === "month" ? Pen.stops.month(pen) : Pen.stops.season();
    const st = { ctl: null, cancel: false, root: null };
    const t = Pen.team(pen.my);
    const view = () => {
      const sl = Pen.standings(pen);
      const me = sl.find((x) => x.id === pen.my);
      const n = regDays(pen);
      return {
        date: pen.day < pen.schedule.length ? Pen.dayLabel(pen, pen.day) : "シーズン終了",
        rec: sl.findIndex((x) => x.id === pen.my) + 1 + "位 " + recText(me),
        pct: n ? Math.min(100, (pen.day / n) * 100) : 100,
        left: Math.max(0, n - pen.day),
        days: st.ctl ? st.ctl.days : 0,
      };
    };
    const scr = {
      isPenSim: true,
      cls: "pen-simscr",
      html() {
        const v = view();
        return (
          '<div class="scr-body pen-simv"><p class="pen-simv-k">' +
          esc(SIM_LABEL[kind] || "") +
          ' 進めています</p><p class="pen-simv-date">' +
          esc(v.date) +
          '</p><p class="pen-simv-rec">' +
          UI.mark(t, 28) +
          "<b>" +
          esc(t.short) +
          '</b><span class="pen-simv-r">' +
          esc(v.rec) +
          '</span></p><div class="pen-simv-bar"><i style="width:' +
          v.pct.toFixed(1) +
          '%"></i></div><p class="pen-simv-left">レギュラーシーズン 残り <b>' +
          v.left +
          '</b> 日　消化 <span class="pen-simv-n">' +
          v.days +
          '</span> 日</p><button class="btn" data-act="cancel"' +
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
        const v = view();
        const q = (sel) => r.querySelector(sel);
        if (q(".pen-simv-date")) q(".pen-simv-date").textContent = v.date;
        if (q(".pen-simv-r")) q(".pen-simv-r").textContent = v.rec;
        if (q(".pen-simv-bar i")) q(".pen-simv-bar i").style.width = v.pct.toFixed(1) + "%";
        if (q(".pen-simv-left b")) q(".pen-simv-left b").textContent = String(v.left);
        if (q(".pen-simv-n")) q(".pen-simv-n").textContent = String(v.days);
      },
      onAct(act) {
        if (act === "cancel" && st.ctl && !st.cancel) {
          st.ctl.stop = true;
          st.cancel = true;
          UI.refresh();
        }
      },
    };
    setTimeout(() => {
      st.ctl = Pen.simUntil(
        pen,
        stop,
        () => {
          if (UI.cur === scr) scr.update();
        },
        () => {
          if (UI.cur === scr) UI.go(pen.finished ? Pen.final() : Pen.hub());
        }
      );
    }, 40);
    return scr;
  };

  // 次の試合 (休みの日の案内)
  function nextGameText(pen) {
    const d = Pen.nextMyDay(pen);
    if (d < 0) return "今季の試合はすべて終わりました";
    const m = pen.schedule[d].find((x) => isMine(pen, x));
    const opp = Pen.team(m.home === pen.my ? m.away : m.home);
    return "次の試合 " + Pen.dayLabel(pen, d) + "　" + (m.home === pen.my ? "vs " : "@ ") + opp.short + (m.il ? "（交流戦）" : "");
  }

  // 試合を画面で行う: 自分の試合を操作 (user = home|away) / 観戦 (user = null・自分の出ない試合)。
  // 終わったらその日の残りの試合を消化して結果画面へ (ポストシーズンはシリーズの状況を添える)
  Pen.playLive = function (pen, m, gi, user) {
    const g = makeGame(pen, m, user);
    UI.hideScreen();
    PB.main.startMatch({
      game: g,
      season: g.season,
      night: Store.settings().night,
      onEnd: (match) => {
        PB.main.stopMatch();
        if (user) {
          const r = Store.data.records;
          r.games++;
          if (g.result.tie) r.ties++;
          else if (g.result.winner === user) r.wins++;
          else r.losses++;
        }
        // 他球場の試合を消化しているあいだ集計画面を出す
        const prog = { k: 0, n: 0 };
        UI.go({
          html: () => '<div class="scr-body busy-body"><p class="busy-t">他球場の試合を集計中…</p><p class="busy-n">' + prog.k + " / " + prog.n + "</p></div>",
        });
        const dayIdx = pen.day;
        const toHub = () => UI.go(pen.finished ? Pen.final() : Pen.hub());
        const started = finishDayAsync(
          pen,
          user ? g : { gi, game: g },
          (k, n) => {
            prog.k = k;
            prog.n = n;
            UI.refresh();
          },
          () => {
            const n = PB.News ? PB.News.dayHRs(pen, dayIdx).length : 0;
            const ser = m.ps && PB.PenPost ? PB.PenPost.statusText(pen, m.ps) : "";
            UI.go(
              Sc.result(match, {
                onDone: toHub,
                doneLabel: m.ps ? "ポストシーズンへ" : "ペナントへ",
                extra: PB.News ? { label: (ser ? ser + "\n" : "") + "今日のホームラン（" + n + "本）", onTap: () => UI.go(PB.News.screen({ day: dayIdx, tab: "hr", onBack: () => Pen.hub() })) } : null,
              })
            );
          }
        );
        // 消化中で受け付けられなかったとき (通常は起きない) は結果だけ出す
        if (!started) UI.go(Sc.result(match, { onDone: () => UI.go(Pen.hub()), doneLabel: "ペナントへ" }));
      },
      onQuit: () => UI.go(Pen.hub()),
    });
  };

  Pen.hub = function () {
    const pen = Store.data.pennant;
    if (!pen) return Pen.setup();
    Pen.migrate(pen);
    if (pen.finished) return Pen.final();
    // レギュラーシーズンの後 (ポストシーズン・表彰式) は専用のハブ
    if (pen.day >= regDays(pen) && PB.PenPost) return PB.PenPost.hub();
    beginDay(pen);
    let busy = false;
    const hs = { lg: myLg(pen), tab: "st" };
    // 途中まで消化した日があれば (集計中に閉じたなど) 残りを先に消化する (自分の試合が未記録ならそれも)
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
    const dated = !!(pen.dates && pen.dates.length);
    const dis = () => (busy ? " disabled" : "");
    return {
      isPenHub: true,
      pen: true,
      html() {
        const m = myMatch(pen);
        const my = Pen.team(pen.my);
        const st = Pen.standings(pen);
        const rank = st.findIndex((x) => x.id === pen.my) + 1;
        const meRow = st.find((x) => x.id === pen.my);
        const mg = Pen.race(pen, myLg(pen)).magic;
        const myM = mg && mg.id === pen.my ? '<span class="pen-m">M' + mg.m + "</span>" : "";
        const gno = Pen.myGameNo(pen);
        const tot = Pen.myTotal(pen);
        let today;
        if (m) {
          const oppId = m.home === pen.my ? m.away : m.home;
          const opp = Pen.team(oppId);
          const isHome = m.home === pen.my;
          const mySP = D.player(my, nextStarter(my, pen));
          const opSP = D.player(opp, nextStarter(opp, pen));
          today =
            '<div class="matchcard"><div class="mc-team">' +
            UI.mark(isHome ? opp : my, 40) +
            "<b>" +
            esc((isHome ? opp : my).short) +
            "</b><small>先発 " +
            esc((isHome ? opSP : mySP).name) +
            '</small></div><div class="mc-vs">VS<small>' +
            esc(Pen.team(m.home).stadium) +
            (m.il ? "<br>交流戦" : "") +
            '</small></div><div class="mc-team">' +
            UI.mark(isHome ? my : opp, 40) +
            "<b>" +
            esc((isHome ? my : opp).short) +
            "</b><small>先発 " +
            esc((isHome ? mySP : opSP).name) +
            "</small></div></div>" +
            '<div class="row-btns"><button class="btn red big" data-act="play"' +
            dis() +
            '>試合開始</button></div><div class="row-btns"><button class="btn" data-act="sim"' +
            dis() +
            ">この試合をおまかせ</button></div>";
        } else {
          today =
            '<div class="pen-off"><b>本日は試合がありません</b><small>' +
            esc(nextGameText(pen)) +
            '</small></div><div class="row-btns"><button class="btn primary" data-act="nextday"' +
            dis() +
            ">次の日へ</button>" +
            (Pen.nextMyDay(pen) >= 0 ? '<button class="btn" data-act="simgo" data-arg="next"' + dis() + ">次の試合まで</button>" : "") +
            "</div>";
        }
        const sims = '<div class="pen-sims"><span class="pen-sims-l">まとめて進める</span><div class="row-btns">' + ["week"].concat(dated ? ["month"] : [], ["season"]).map((k) => '<button class="btn sm" data-act="simgo" data-arg="' + k + '"' + dis() + ">" + SIM_LABEL[k] + "</button>").join("") + "</div></div>";
        return (
          UI.header("ペナント", "back") +
          '<div class="scr-body">' +
          '<div class="pen-top"><div class="pen-date"><b>' +
          esc(Pen.dayLabel(pen, pen.day)) +
          "</b><span>" +
          (gno > tot ? "全" + tot + "戦 終了" : (m ? "第" + gno + "戦" : "次は第" + gno + "戦") + " / 全" + tot + "戦") +
          "</span></div>" +
          '<div class="pen-rank">' +
          (st.some((x) => x.g > 0) ? "<b>" + rank + "</b>位 " + recText(meRow) + myM : "<b>開幕前</b>") +
          "</div></div>" +
          today +
          (PB.PenLife && pen.teams ? PB.PenLife.hubLine(pen) : "") +
          sims +
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
          Sc.seg(
            "sttab",
            [
              ["st", "順位"],
              ["detail", "直近・連勝"],
              ["vs", "対戦成績"],
            ],
            hs.tab
          ) +
          (hs.tab === "detail" ? Pen.detailHTML(pen, hs.lg) : hs.tab === "vs" ? Pen.vsHTML(pen, hs.lg) : Pen.standingsHTML(pen, hs.lg === myLg(pen) ? st : Pen.standings(pen, hs.lg), { race: true })) +
          '<div class="row-btns"><button class="btn" data-act="order">オーダー</button><button class="btn" data-act="leaders">個人成績</button><button class="btn" data-act="results">試合結果</button></div>' +
          (PB.PenLife && pen.teams ? '<div class="row-btns"><button class="btn" data-act="roster">一軍・二軍</button><button class="btn" data-act="records">記録室</button></div>' : "") +
          '<div class="row-btns"><button class="btn" data-act="sched">日程</button>' +
          (PB.News && pen.results.length ? '<button class="btn" data-act="news" data-arg="news">スポーツニュース</button>' : "") +
          "</div>" +
          '<div class="row-btns"><button class="btn ghost" data-act="abandon">シーズンをやめる</button></div>' +
          "</div>"
        );
      },
      onAct(act, arg) {
        if (busy || dayLock) return;
        if (act === "back") return UI.go(Sc.title());
        if (act === "roster" && PB.PenLife) return UI.go(PB.PenLife.screen());
        if (act === "records" && PB.PenRecords) return UI.go(PB.PenRecords.screen());
        if (act === "stlg") {
          hs.lg = arg;
          return UI.refresh();
        }
        if (act === "sttab") {
          hs.tab = arg;
          return UI.refresh();
        }
        if (act === "news") return UI.go(PB.News.screen({ tab: arg || "hr" }));
        if (act === "order") return UI.go(Pen.orderScreen());
        if (act === "leaders") return UI.go(Pen.leaders());
        if (act === "results") return UI.go(Pen.results());
        if (act === "sched") return UI.go(Pen.schedule());
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
        if (act === "simgo") return UI.go(Pen.simScreen(arg));
        if (act === "play") {
          const m = myMatch(pen);
          if (!m) return;
          return Pen.playLive(pen, m, pen.schedule[pen.day].indexOf(m), m.home === pen.my ? "home" : "away");
        }
        if (act === "sim" || act === "nextday") {
          // この試合をおまかせ (物理版で精密に) / 休みの日を進める
          busy = true;
          UI.refresh();
          setTimeout(() => {
            let g = null;
            const m = myMatch(pen);
            if (act === "sim" && m) {
              g = makeGame(pen, m, null);
              g.simToEnd();
            }
            if (
              !finishDayAsync(pen, g, null, () => {
                busy = false;
                if (pen.finished) return UI.go(Pen.final());
                // レギュラーシーズンが終わったらポストシーズンのハブへ
                if (pen.day >= regDays(pen)) return UI.go(Pen.hub());
                if (UI.cur && UI.cur.isPenHub) UI.refresh();
              })
            ) {
              busy = false;
              UI.refresh();
            }
          }, 60);
        }
      },
    };
  };

  // 順位表 (試・勝・敗・分・率・差・残。首位の差の欄にマジック)
  Pen.standingsHTML = function (pen, st, o) {
    const list = st || Pen.standings(pen);
    const lg = list.length ? lgOf(list[0].id) : myLg(pen);
    const opt = o || {};
    const rc = Pen.race(pen, lg);
    const champ = (pen.clinch && pen.clinch[lg] && pen.clinch[lg].id) || rc.champ;
    const po = lg === "P" ? Object.keys((pen.clinch && pen.clinch.po) || {}) : [];
    const begun = list.some((x) => x.g > 0);
    const mark = (x, i) => {
      // 開幕前は差を出さない
      if (!begun) return "-";
      if (i !== 0) return x.gb.toFixed(1);
      if (champ === x.id) return '<span class="pen-v">' + (lg === "P" ? "1位" : "優勝") + "</span>";
      if (rc.magic && rc.magic.id === x.id) return '<span class="pen-mg">M' + rc.magic.m + "</span>";
      return "-";
    };
    let foot = "";
    if (opt.race) {
      const bits = [];
      if (champ) bits.push(Pen.team(champ).short + (lg === "P" ? "がレギュラーシーズン1位通過" : "が優勝"));
      else if (rc.magic) bits.push(Pen.team(rc.magic.id).short + "に" + (lg === "P" ? "1位通過" : "優勝") + "マジック" + rc.magic.m);
      if (po.length) bits.push("プレーオフ進出: " + po.map((id) => Pen.team(id).short).join("・"));
      if (bits.length) foot = '<p class="pen-race">' + esc(bits.join("　")) + "</p>";
    }
    return (
      '<div class="tbl-wrap"><table class="stand pen-st"><tr><th>順</th><th>チーム</th><th>試</th><th>勝</th><th>敗</th><th>分</th><th>率</th><th>差</th><th>残</th></tr>' +
      list
        .map((x, i) => {
          const t = Pen.team(x.id);
          return (
            "<tr" +
            (x.id === pen.my ? ' class="me"' : "") +
            "><td>" +
            (i + 1) +
            "</td><th>" +
            UI.mark(t, 16) +
            " " +
            esc(t.short) +
            (po.indexOf(x.id) >= 0 && champ !== x.id ? '<i class="pen-po">PO</i>' : "") +
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
            mark(x, i) +
            "</td><td>" +
            x.rem +
            "</td></tr>"
          );
        })
        .join("") +
      "</table></div>" +
      foot
    );
  };
  // 直近 10 試合・連勝/連敗・得失点
  Pen.detailHTML = function (pen, lg) {
    const st = Pen.standings(pen, lg);
    return (
      '<div class="tbl-wrap"><table class="stand pen-st pen-dt"><tr><th>順</th><th>チーム</th><th>直近10試合</th><th>連</th><th>得</th><th>失</th></tr>' +
      st
        .map((x, i) => {
          const t = Pen.team(x.id);
          const rc = Pen.recent(pen, x.id, 10);
          const sk = rc.streak && rc.streak.n >= 2 ? rc.streak.n + (rc.streak.kind === "w" ? "勝" : "敗") : "-";
          return (
            "<tr" +
            (x.id === pen.my ? ' class="me"' : "") +
            "><td>" +
            (i + 1) +
            "</td><th>" +
            UI.mark(t, 16) +
            " " +
            esc(t.short) +
            '</th><td class="pen-l10">' +
            (rc.last.length ? rc.last.map((k) => '<i class="' + k + '">' + (k === "w" ? "○" : k === "l" ? "●" : "△") + "</i>").join("") : "-") +
            '</td><td class="' +
            (rc.streak ? rc.streak.kind : "") +
            '">' +
            sk +
            "</td><td>" +
            x.rs +
            "</td><td>" +
            x.ra +
            "</td></tr>"
          );
        })
        .join("") +
      "</table></div>"
    );
  };
  // 対戦成績 (行の球団から見た 勝-敗(-分))
  Pen.vsHTML = function (pen, lg) {
    const st = Pen.standings(pen, lg);
    const ids = st.map((x) => x.id);
    const rec = {};
    for (const r of Pen.regResults(pen)) {
      if (ids.indexOf(r.home) < 0 || ids.indexOf(r.away) < 0) continue;
      for (const [me, op, ms, os] of [
        [r.home, r.away, r.hs, r.as],
        [r.away, r.home, r.as, r.hs],
      ]) {
        const k = me + "|" + op;
        const x = rec[k] || (rec[k] = [0, 0, 0]);
        x[ms > os ? 0 : ms < os ? 1 : 2]++;
      }
    }
    return (
      '<div class="tbl-wrap"><table class="stand pen-st pen-vs"><tr><th></th>' +
      ids.map((id) => "<th>" + UI.mark(Pen.team(id), 18) + "</th>").join("") +
      "</tr>" +
      ids
        .map(
          (a) =>
            "<tr" +
            (a === pen.my ? ' class="me"' : "") +
            "><th>" +
            UI.mark(Pen.team(a), 16) +
            " " +
            esc(Pen.team(a).short) +
            "</th>" +
            ids
              .map((b) => {
                if (a === b) return '<td class="muted">—</td>';
                const x = rec[a + "|" + b] || [0, 0, 0];
                return '<td class="' + (x[0] > x[1] ? "w" : x[0] < x[1] ? "l" : "") + '">' + x[0] + "-" + x[1] + (x[2] ? "<small>-" + x[2] + "</small>" : "") + "</td>";
              })
              .join("") +
            "</tr>"
        )
        .join("") +
      "</table></div>" +
      '<p class="note small">行の球団から見た 勝-敗(-分)。リーグ内の対戦だけ。</p>'
    );
  };

  // 日程 (月ごと): 済みはスコアと○●、これからは相手・ホーム/ビジター
  Pen.schedule = function () {
    const pen = Store.data.pennant;
    const dated = !!(pen.dates && pen.dates.length);
    const mine = [];
    for (let d = 0; d < pen.schedule.length; d++) {
      const gi = pen.schedule[d].findIndex((m) => isMine(pen, m));
      if (gi >= 0) mine.push({ d, gi, m: pen.schedule[d][gi] });
    }
    const monthOf = (x) => (dated ? Sched().month(pen.dates[x.d]) : Math.floor(x.d / 10));
    const months = [...new Set(mine.map(monthOf))];
    const cur = mine.find((x) => x.d >= pen.day);
    const st = { mo: cur ? monthOf(cur) : months[months.length - 1] };
    const resOf = (x) => pen.results.find((r) => r.day === x.d && r.gi === x.gi);
    const moName = (k) => (dated ? k + "月" : k * 10 + 1 + "〜" + (k * 10 + 10) + "日目");
    return {
      html() {
        const rows = mine.filter((x) => monthOf(x) === st.mo);
        let w = 0;
        let l = 0;
        let dr = 0;
        const body = rows
          .map((x) => {
            const r = resOf(x);
            const home = x.m.home === pen.my;
            const opp = Pen.team(home ? x.m.away : x.m.home);
            const date = dated ? Sched().short(pen.dates[x.d]) + "<small>(" + Sched().dowName(pen.dates[x.d]) + ")</small>" : "第" + (x.d + 1) + "日";
            let right;
            let cls = "";
            if (r) {
              const ms = home ? r.hs : r.as;
              const os = home ? r.as : r.hs;
              const k = ms > os ? "w" : ms < os ? "l" : "d";
              if (k === "w") w++;
              else if (k === "l") l++;
              else dr++;
              cls = " done " + k;
              right = '<span class="ps-sc">' + ms + "-" + os + (r.inn > (pen.innings || 9) ? "<small>延" + r.inn + "</small>" : "") + '</span><span class="ps-wl">' + (k === "w" ? "○" : k === "l" ? "●" : "△") + "</span>";
            } else right = '<span class="ps-st">' + esc(Pen.team(x.m.home).stadium || "") + "</span>" + (x.d === pen.day ? '<span class="ps-today">今日</span>' : "");
            return (
              '<div class="ps-row' +
              cls +
              (x.d === pen.day ? " today" : "") +
              '"' +
              (r && PB.News ? ' data-act="day" data-arg="' + x.d + '"' : "") +
              '><span class="ps-d">' +
              date +
              '</span><span class="ps-ha ' +
              (home ? "h" : "a") +
              '">' +
              (home ? "H" : "A") +
              "</span>" +
              UI.mark(opp, 22) +
              '<b class="ps-opp">' +
              esc(opp.short) +
              (x.m.il ? "<small>交流戦</small>" : "") +
              (x.m.ps && PB.PenPost ? "<small>" + esc(PB.PenPost.tagOf(pen, x.m.ps)) + "</small>" : "") +
              "</b>" +
              right +
              "</div>"
            );
          })
          .join("");
        return (
          UI.header("日程", "back") +
          '<div class="scr-body">' +
          (dated ? '<p class="note small">2004年の暦に合わせた架空の日程です（曜日・休日の並びのみ2004年風。開幕日などはゲームの設定）。' + (pen.opts && pen.opts.strike && pen.opts.len === "full" ? "9月18・19日は選手会のストライキで中止（史実）。" : "") + "</p>" : "") +
          Sc.seg(
            "mo",
            months.map((k) => [k, moName(k)]),
            st.mo
          ) +
          '<p class="ps-sum">' +
          esc(moName(st.mo)) +
          "　" +
          rows.length +
          "試合" +
          (w + l + dr ? "　" + w + "勝" + l + "敗" + (dr ? dr + "分" : "") : "") +
          "</p>" +
          '<div class="ps-list">' +
          (body || '<p class="muted center">試合がありません</p>') +
          "</div></div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Pen.hub());
        if (act === "mo") st.mo = Number(arg);
        if (act === "day" && PB.News) return UI.go(PB.News.screen({ day: Number(arg), tab: "res", onBack: () => Pen.schedule() }));
        UI.refresh();
      },
    };
  };

  Pen.setup = function () {
    const S = Store.settings();
    const st = { my: "t", len: "full", strike: true, il: false, post: "2004", fast: "auto", level: S.level, innings: 9 };
    const POST_NOTE = {
      2004: "2004年と同じ: パ・リーグはプレーオフ（第1ステージ 2位-3位・第2ステージは1位と対戦。1位が2位に5ゲーム差以上なら1位に1勝）の勝者が優勝。セ・リーグはプレーオフなし。その後に日本シリーズ（4勝先取）",
      cs: "後年ルール（2007年〜の方式・このゲームの設定）: 両リーグでクライマックスシリーズ（ファースト 3試合制・ファイナル 6試合制で1位に1勝）。リーグ優勝はレギュラーシーズン1位。2004年にはありません",
      none: "ポストシーズンなし。レギュラーシーズンの後にタイトル・表彰だけ行います",
    };
    const fastOf = () => (st.fast === "auto" ? (Sched().isShort(st.len) ? "phys" : "quick") : st.fast);
    const chk = (act, on, label, sub) => '<button class="pen-chk' + (on ? " on" : "") + '" data-act="' + act + '" role="switch" aria-checked="' + (on ? "true" : "false") + '"><i></i><span>' + esc(label) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span></button>";
    const lenNote = () => {
      if (st.len === "full") return st.il ? "各球団146試合（リーグ内110・交流戦36）" : st.strike ? "セ・リーグ138試合・パ・リーグ133試合（2004年と同じ）" : "セ・リーグ140試合・パ・リーグ135試合";
      if (st.len === "half") return "各球団70試合（同一リーグの5球団と14試合ずつ）";
      const L = Sched().LENS[st.len];
      return "各球団" + L.perPair * 5 + "試合（同一リーグの5球団と" + L.perPair + "試合ずつ）";
    };
    return {
      html() {
        return (
          UI.header("ペナント 新規作成", "back") +
          '<div class="scr-body"><p class="note">セ・パ12球団の2004年シーズン。自分のチームの試合は自分で操作するか、おまかせで消化できます。他球場の試合や日程はまとめて進められます。</p><h3 class="lbl">あなたのチーム</h3>' +
          Sc.teamPicker("my", st.my, null) +
          '<h3 class="lbl">試合数</h3>' +
          Sc.seg(
            "len",
            [
              ["s10", "10"],
              ["s20", "20"],
              ["s30", "30"],
              ["half", "ハーフ"],
              ["full", "フル"],
            ],
            st.len
          ) +
          '<p class="note small pen-lennote">' +
          esc(lenNote()) +
          "。日程は2004年の暦に合わせた架空のものです（" +
          (Sched().isShort(st.len) ? "両リーグ4月2日開幕" : "パ3月27日・セ4月2日開幕") +
          "）</p>" +
          (st.len === "full"
            ? chk("strike", st.strike && !st.il, "9月の選手会ストライキで中止", "史実: 9月18・19日の2試合が中止・振替なし") +
              chk("il", st.il, "交流戦あり（後年ルール）", "2005年から始まった方式（このゲームの設定）。2004年にはありません")
            : "") +
          '<h3 class="lbl">ポストシーズン</h3>' +
          Sc.seg(
            "post",
            [
              ["2004", "2004年方式"],
              ["cs", "CS（後年ルール）"],
              ["none", "なし"],
            ],
            st.post
          ) +
          '<p class="note small pen-postnote">' +
          esc(POST_NOTE[st.post]) +
          "</p>" +
          '<h3 class="lbl">他球場の試合</h3>' +
          Sc.seg(
            "fast",
            [
              ["auto", "おすすめ"],
              ["quick", "高速"],
              ["phys", "精密"],
            ],
            st.fast
          ) +
          '<p class="note small">' +
          (fastOf() === "quick" ? "高速: 打球の結果を物理シミュレーションから作った表で決めます。フルでもすぐ進みます。" : "精密: すべての打球を物理シミュレーションで計算します（1日数秒かかります）。") +
          "自分のチームの試合を「この試合をおまかせ」にしたときは常に精密です。</p>" +
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
        else if (act === "len") st.len = arg;
        else if (act === "strike") st.strike = !st.strike;
        else if (act === "il") st.il = !st.il;
        else if (act === "fast") st.fast = arg;
        else if (act === "post") st.post = arg;
        else if (act === "inn") st.innings = Number(arg);
        else if (act === "level") st.level = arg;
        else if (act === "go") {
          const full = st.len === "full";
          Pen.create(st.my, { len: st.len, innings: st.innings, level: st.level, strike: full && st.strike && !st.il, il: full && st.il, post: st.post !== "none", cs: st.post === "cs", fast: fastOf() });
          return UI.go(Pen.hub());
        }
        UI.refresh();
      },
    };
  };

  // o = { tab, lg, onBack }
  Pen.leaders = function (o) {
    const pen = Store.data.pennant;
    const st = { tab: (o && o.tab) || "bat", lg: (o && o.lg) || myLg(pen) };
    const lgs = Object.keys(D.LEAGUES || {}).filter((k) => lgTeams(pen, k).length);
    return {
      html() {
        // 規定打席・規定投球回は所属球団の試合数から
        const tg = {};
        for (const k of lgs) for (const x of Pen.standings(pen, k)) tg[x.id] = x.g;
        const all = [];
        for (const t of lgTeams(pen, st.lg)) for (const p of t.players) if (pen.stats[p.id]) all.push({ p, t, s: pen.stats[p.id], g: tg[t.id] || 0 });
        const top = (arr, f, fmt, n) =>
          arr
            .sort((a, b) => f(b) - f(a))
            .slice(0, n || 5)
            .map((x, i) => '<tr data-act="player" data-arg="' + esc(x.p.id) + '"><td>' + (i + 1) + "</td><th>" + UI.mark(x.t, 14) + " " + esc(x.p.name) + "</th><td>" + fmt(x) + "</td></tr>")
            .join("");
        const block = (title, rows) => '<div class="lead"><h4>' + title + '</h4><table class="ltbl">' + (rows || '<tr><td class="muted">記録なし</td></tr>') + "</table></div>";
        let html = "";
        if (st.tab === "title") html = PB.PenAwards ? PB.PenAwards.raceHTML(pen, st.lg) : "";
        else if (st.tab === "bat") {
          const qual = all.filter((x) => x.p.pos !== "P" && (x.s.pa || 0) >= Math.max(1, x.g * 3.1));
          const bats = all.filter((x) => x.p.pos !== "P");
          html =
            block("打率", top(qual, (x) => (x.s.ab ? x.s.h / x.s.ab : 0), (x) => U.fmtAvg(x.s.h || 0, x.s.ab || 0))) +
            block("本塁打", top(bats, (x) => x.s.hr || 0, (x) => (x.s.hr || 0) + "本")) +
            block("打点", top(bats, (x) => x.s.rbi || 0, (x) => (x.s.rbi || 0) + "点")) +
            block("安打", top(bats, (x) => x.s.h || 0, (x) => (x.s.h || 0) + "本")) +
            block("盗塁", top(bats, (x) => x.s.sb || 0, (x) => (x.s.sb || 0) + "個"));
        } else {
          const pits = all.filter((x) => x.p.pos === "P");
          const qual = pits.filter((x) => (x.s.outs || 0) >= Math.max(3, x.g * 3));
          html =
            block("防御率", top(qual, (x) => -(x.s.er || 0) / Math.max(1, x.s.outs || 0), (x) => U.fmtERA(x.s.er || 0, x.s.outs || 0))) +
            block("勝利", top(pits, (x) => x.s.w || 0, (x) => (x.s.w || 0) + "勝")) +
            block("奪三振", top(pits, (x) => x.s.pk || 0, (x) => (x.s.pk || 0) + "個")) +
            block("セーブ", top(pits, (x) => x.s.sv || 0, (x) => (x.s.sv || 0) + "S")) +
            // 完投・ホールドは v3 から記録 (それより前のセーブは「記録なし」)
            (pen.statsSince
              ? block("ホールド", '<tr><td class="muted">記録なし（途中のセーブのため）</td></tr>') + block("完投", '<tr><td class="muted">記録なし（途中のセーブのため）</td></tr>')
              : block("ホールド", top(pits.filter((x) => x.s.hld), (x) => x.s.hld || 0, (x) => (x.s.hld || 0) + "H")) + block("完投", top(pits.filter((x) => x.s.cg), (x) => (x.s.cg || 0) * 10 + (x.s.sho || 0), (x) => (x.s.cg || 0) + "完投" + (x.s.sho ? "（完封" + x.s.sho + "）" : ""))));
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
            ].concat(PB.PenAwards ? [["title", "タイトル争い"]] : []),
            st.tab
          ) +
          (st.tab === "title" ? html : '<div class="leads">' + html + "</div>") +
          "</div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(o && o.onBack ? o.onBack() : pen.finished ? Pen.final() : Pen.hub());
        if (act === "tab") st.tab = arg;
        if (act === "lg") st.lg = arg;
        if (act === "player") return Pen.showPlayer(arg);
        UI.refresh();
      },
    };
  };

  Pen.results = function () {
    const pen = Store.data.pennant;
    const dated = !!(pen.dates && pen.dates.length);
    return {
      html() {
        const mine = pen.results.filter((r) => r.home === pen.my || r.away === pen.my).slice().reverse();
        return (
          UI.header("試合結果", "back") +
          '<div class="scr-body"><div class="olist">' +
          (mine.length
            ? mine
                .map((r) => {
                  const h = Pen.team(r.home);
                  const a = Pen.team(r.away);
                  const myScore = r.home === pen.my ? r.hs : r.as;
                  const opScore = r.home === pen.my ? r.as : r.hs;
                  const wl = myScore > opScore ? "win" : myScore < opScore ? "lose" : "tie";
                  const tag = r.ps && PB.PenPost ? PB.PenPost.tagOf(pen, r.ps) + (r.gn ? " 第" + r.gn + "戦" : "") : "";
                  return (
                    '<div class="rrow ' +
                    wl +
                    (tag ? " pp-rrow" : "") +
                    '"' +
                    (PB.News ? ' data-act="day" data-arg="' + r.day + '"' : "") +
                    '><span class="d' +
                    (dated ? " pen-d" : "") +
                    '">' +
                    esc(Pen.dayShort(pen, r.day)) +
                    "</span>" +
                    UI.mark(a, 18) +
                    "<b>" +
                    esc(a.short) +
                    '</b><span class="sc">' +
                    r.as +
                    " - " +
                    r.hs +
                    (tag ? "<small>" + esc(tag) + "</small>" : "") +
                    "</span><b>" +
                    esc(h.short) +
                    "</b>" +
                    UI.mark(h, 18) +
                    '<span class="wl">' +
                    (wl === "win" ? "○" : wl === "lose" ? "●" : "△") +
                    "</span></div>"
                  );
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

  // シーズンの終わり: v3 以降はシーズン総括 (優勝・日本一・最終順位・タイトルと表彰へ)。
  // それより前に終わった旧セーブは今までの最終画面のまま (ポストシーズン・表彰を作り話で足さない)
  Pen.final = function () {
    const pen = Store.data.pennant;
    if (pen.legacyEnd || (!pen.post && !pen.awards)) return legacyFinal(pen);
    return Pen.summary(pen);
  };

  // シーズン総括
  Pen.summary = function (pen) {
    const PP = PB.PenPost;
    const ch = PP ? PP.champions(pen) : { lg: {}, rows: [] };
    const js = ch.js ? Pen.team(ch.js) : null;
    const lgs = Object.keys(D.LEAGUES || {}).filter((k) => lgTeams(pen, k).length);
    const order = [myLg(pen)].concat(lgs.filter((k) => k !== myLg(pen)));
    const won = ch.js === pen.my || (!ch.js && ch.lg[myLg(pen)] === pen.my);
    if (won) setTimeout(() => PB.Audio && PB.Audio.victory && PB.Audio.victory(), 200);
    const head = js ? (ch.js === pen.my ? "日本一！！" : esc(js.short) + " 日本一") : ch.lg[myLg(pen)] ? (ch.lg[myLg(pen)] === pen.my ? "優勝！！" : esc(Pen.team(ch.lg[myLg(pen)]).short) + " 優勝") : "シーズン終了";
    const big = js || (ch.lg[myLg(pen)] ? Pen.team(ch.lg[myLg(pen)]) : null);
    return {
      cls: "result",
      html() {
        const st = Pen.standings(pen);
        const me = st.find((x) => x.id === pen.my);
        const rank = st.indexOf(me) + 1;
        const myPost = PP ? PP.myResult(pen) : "";
        return (
          '<div class="scr-body res-body pen-sum"><div class="res-head ' +
          (won ? "win" : "") +
          '"><p class="walkoff">' +
          (pen.year || 2004) +
          "年シーズン 総括</p><h2>" +
          head +
          "</h2>" +
          (big ? UI.mark(big, 64) : "") +
          (ch.jsLine ? '<p class="pen-sum-sub">' + esc(ch.jsLine) + "</p>" : "") +
          "</div>" +
          '<div class="pen-champs n' +
          ch.rows.filter((r) => !r.big).length +
          '">' +
          ch.rows
            .map(
              (r) =>
                '<div class="pen-ch' +
                (r.id === pen.my ? " me" : "") +
                (r.big ? " big" : "") +
                '"><span class="pen-ch-l">' +
                esc(r.label) +
                "</span>" +
                (r.id ? UI.mark(Pen.team(r.id), 30) + "<b>" + esc(Pen.team(r.id).short) + "</b>" : "<b class=\"muted\">-</b>") +
                (r.sub ? "<small>" + esc(r.sub) + "</small>" : "") +
                "</div>"
            )
            .join("") +
          "</div>" +
          '<p class="pen-sum-me">' +
          UI.mark(Pen.team(pen.my), 20) +
          "<b>" +
          esc(Pen.team(pen.my).short) +
          "</b>" +
          esc(D.LEAGUES[myLg(pen)] ? (myLg(pen) === "P" ? "パ・リーグ " : "セ・リーグ ") : "") +
          rank +
          "位 " +
          esc(recText(me)) +
          (myPost ? "<small>" + esc(myPost) + "</small>" : "") +
          "</p>" +
          '<div class="row-btns"><button class="btn primary" data-act="awards">タイトル・表彰</button>' +
          (pen.post && pen.post.series && pen.post.series.length ? '<button class="btn" data-act="post">ポストシーズン</button>' : "") +
          "</div>" +
          order
            .map((k) => '<h3 class="lbl">' + esc(D.LEAGUES[k]) + " 最終順位</h3>" + Pen.standingsHTML(pen, Pen.standings(pen, k)))
            .join("") +
          '<div class="row-btns"><button class="btn" data-act="leaders">個人成績</button>' +
          (PB.PenRecords && pen.records ? '<button class="btn" data-act="records">記録室</button>' : "") +
          (PB.News && pen.results.length ? '<button class="btn" data-act="news">スポーツニュース</button>' : "") +
          '</div><div class="row-btns pen-sum-end"><button class="btn red" data-act="new">新しいシーズン</button><button class="btn" data-act="title">タイトルへ</button></div></div>'
        );
      },
      onAct(act) {
        const back = () => Pen.final();
        if (act === "records" && PB.PenRecords) return UI.go(PB.PenRecords.screen({ onBack: back }));
        if (act === "awards" && PB.PenAwards) return UI.go(PB.PenAwards.screen({ onBack: back }));
        if (act === "post" && PP) return UI.go(PP.bracketScreen({ onBack: back }));
        if (act === "leaders") return UI.go(Pen.leaders({ onBack: back }));
        if (act === "news") return UI.go(PB.News.screen({ onBack: back }));
        if (act === "new")
          return UI.confirm(
            "新しいシーズンを始めます。今のシーズンの成績は消えます。よろしいですか？",
            () => {
              Store.data.pennant = null;
              Store.save();
              UI.go(Pen.setup());
            },
            { yes: "始める", danger: true }
          );
        if (act === "title") UI.go(Sc.title());
      },
    };
  };

  // 旧セーブの終わったシーズン (v3 より前): 今までの最終画面
  function legacyFinal(pen) {
    const st = Pen.standings(pen);
    const champ = Pen.team(st[0].id);
    const won = st[0].id === pen.my;
    if (won) setTimeout(() => PB.Audio.victory(), 200);
    return {
      cls: "result",
      html() {
        return (
          '<div class="scr-body res-body"><div class="res-head ' +
          (won ? "win" : "") +
          '"><p class="walkoff">ペナントレース終了</p><h2>' +
          (won ? (myLg(pen) === "P" ? "1位通過！！" : "優勝！！") : esc(champ.name) + (myLg(pen) === "P" ? " 1位" : " 優勝")) +
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
  }

  // テスト用 (node から日程を進める)
  Pen._internal = { finishDay, finishDayAsync, makeGame, myMatch, recordGame, hrGameStreak, closeDay, pendingGames, myRecorded, schedInfo, h2hLeft, tiredList, nextStarter, mergeStats, regDays, beginDay };
  PB.Pennant = Pen;
})((window.PB = window.PB || {}));
